import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Film, Heart, MessageCircle, UserRoundPlus, X } from 'lucide-react';
import { avatarUrl } from '../lib/avatar';
import { supabase } from '../lib/supabase';

type NotificationRow = { id: string; kind: string; actor_id: string | null; entity_id: string | null; read_at: string | null; created_at: string; actor?: { display_name: string; avatar_url: string | null } };
type Props = { userId: string; onNavigate: (path: string) => void };

const notificationDateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function formatNotificationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Just now' : notificationDateFormatter.format(date);
}

function notificationVerb(kind: string) {
  if (kind === 'follow') return 'started following you.';
  if (kind === 'reaction') return 'reacted to your post.';
  if (kind === 'reply') return 'replied to you.';
  if (kind === 'review_reply') return 'replied to your review.';
  if (kind === 'review_helpful') return 'found your review helpful.';
  if (kind === 'message') return 'sent you a message.';
  if (kind === 'watch_party') return 'invited you to a watch party.';
  return 'commented on your post.';
}

function notificationDestination(item: NotificationRow) {
  if (item.kind === 'follow' && item.actor_id) return `/profile/${item.actor_id}`;
  if ((item.kind === 'review_helpful' || item.kind === 'review_reply') && item.entity_id) return `/community?space=Reviews&review=${item.entity_id}`;
  if (item.kind === 'watch_party') return '/schedule';
  if (item.entity_id) return `/community?post=${item.entity_id}`;
  return '/community';
}

export default function NotificationCenter({ userId, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', userId],
    enabled: Boolean(supabase && userId),
    refetchInterval: open ? 15_000 : 45_000,
    queryFn: async () => {
      if (!supabase) return { rows: [] as NotificationRow[], unreadCount: 0 };
      const [{ data: rows, error }, { count, error: countError }] = await Promise.all([
        supabase.from('notifications').select('id,kind,actor_id,entity_id,read_at,created_at').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(30),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null),
      ]);
      if (error || countError) throw new Error('Notifications could not be loaded.');
      const actorIds = [...new Set((rows ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
      const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id,display_name,avatar_url').in('id', actorIds) : { data: [] };
      const byId = new Map((actors ?? []).map((actor) => [actor.id, actor]));
      return { rows: (rows ?? []).map((row) => ({ ...row, actor: row.actor_id ? byId.get(row.actor_id) : undefined })) as NotificationRow[], unreadCount: count ?? 0 };
    },
  });
  const notifications = query.data?.rows ?? [];
  const unread = query.data?.unreadCount ?? 0;

  async function markRead(item: NotificationRow) {
    if (!supabase) return;
    if (!item.read_at) {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id).eq('recipient_id', userId);
      if (error) return;
      await client.invalidateQueries({ queryKey: ['notifications', userId] });
    }
    setOpen(false);
    onNavigate(notificationDestination(item));
  }

  async function markAllRead() {
    if (!supabase || unread === 0) return;
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null);
    if (!error) void client.invalidateQueries({ queryKey: ['notifications', userId] });
  }

  function description(item: NotificationRow) {
    const actor = item.actor?.display_name ?? 'A film lover';
    if (item.kind === 'follow') return <><b>{actor}</b> started following you.</>;
    if (item.kind === 'reaction') return <><b>{actor}</b> reacted to your post.</>;
    if (item.kind === 'reply') return <><b>{actor}</b> replied to you.</>;
    if (item.kind === 'review_helpful') return <><b>{actor}</b> found your review helpful.</>;
    if (item.kind === 'review_reply') return <><b>{actor}</b> replied to your review.</>;
    if (item.kind === 'message') return <><b>{actor}</b> sent you a message.</>;
    if (item.kind === 'watch_party') return <><b>{actor}</b> invited you to a watch party.</>;
    return <><b>{actor}</b> commented on your post.</>;
  }

  function icon(kind: string) {
    if (kind === 'follow') return <UserRoundPlus size={16}/>;
    if (kind === 'reaction') return <Heart size={16}/>;
    if (kind === 'comment' || kind === 'reply' || kind === 'review_reply') return <MessageCircle size={16}/>;
    return <Film size={16}/>;
  }

  return <div className="notification-center">
    <button type="button" className="icon-button notification-button" onClick={() => setOpen((value) => !value)} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open}>
      <Bell size={18}/>{unread > 0 && <span className="notification-count" aria-live="polite">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <><button type="button" className="notification-dismiss" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={16}/></button><section className="notification-popover" aria-label="Notifications">
      <header><div><h2>Notifications</h2><span>{unread ? `${unread} unread` : 'You’re all caught up'}</span></div><button disabled={!unread} onClick={() => void markAllRead()} aria-label="Mark all as read"><CheckCheck size={17}/></button></header>
      {query.isError && <div className="notification-empty"><b>Couldn’t load notifications.</b><button onClick={() => void query.refetch()}>Try again</button></div>}
      {!query.isError && notifications.length === 0 && <div className="notification-empty"><Bell size={20}/><b>No notifications yet</b><span>Follows, comments, and reactions will show up here.</span></div>}
      <div className="notification-list">{notifications.slice(0, 8).map((item) => <button className={`notification-row ${item.read_at ? '' : 'is-unread'}`} key={item.id} onClick={() => void markRead(item)}>
        <span className="notification-avatar">{item.actor?.avatar_url ? <img src={avatarUrl(item.actor.avatar_url) ?? ''} alt=""/> : icon(item.kind)}</span><span className="notification-copy"><span>{description(item)}</span><time dateTime={item.created_at}>{formatNotificationDate(item.created_at)}</time></span>{!item.read_at && <i aria-label="Unread"/>}
      </button>)}</div>
      <button className="notifications-all" onClick={() => { setOpen(false); onNavigate('/notifications'); }}>See all notifications</button>
    </section></>}
  </div>;
}

export function NotificationsPage({ userId, onNavigate }: Props) {
  const [reload, setReload] = useState(0);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['notifications', userId, reload], enabled: Boolean(supabase && userId), queryFn: async () => {
    if (!supabase) return { rows: [] as NotificationRow[], unreadCount: 0 };
    const [{ data: rows, error }, { count, error: countError }] = await Promise.all([
      supabase.from('notifications').select('id,kind,actor_id,entity_id,read_at,created_at').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(100),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null),
    ]);
    if (error || countError) throw new Error('Notifications could not be loaded.');
    const ids = [...new Set((rows ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
    const { data: actors } = ids.length ? await supabase.from('profiles').select('id,display_name,avatar_url').in('id', ids) : { data: [] };
    const byId = new Map((actors ?? []).map((actor) => [actor.id, actor]));
    return { rows: (rows ?? []).map((row) => ({ ...row, actor: row.actor_id ? byId.get(row.actor_id) : undefined })) as NotificationRow[], unreadCount: count ?? 0 };
  } });
  async function open(item: NotificationRow) {
    if (supabase && !item.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id).eq('recipient_id', userId);
    await client.invalidateQueries({ queryKey: ['notifications', userId] });
    onNavigate(notificationDestination(item));
  }
  async function markAll() {
    if (!supabase) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null);
    setReload((value) => value + 1);
    void client.invalidateQueries({ queryKey: ['notifications', userId] });
  }
  const rows = query.data?.rows ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;
  return <section className="notifications-page"><header><div><span>YOUR SOCIAL SCREENING ROOM</span><h1>Notifications</h1><p>Follows, reactions, and replies from your film community.</p></div><button disabled={unreadCount === 0} onClick={() => void markAll()}><CheckCheck size={16}/> Mark all read</button></header>{query.isError && <div className="community-error-panel"><b>Notifications couldn’t load.</b><span>{query.error.message}</span><button onClick={() => void query.refetch()}>Try again</button></div>}{query.isPending && <p className="community-state">Loading notifications…</p>}{!query.isPending && rows.length === 0 && <div className="community-empty"><Bell/><b>You’re all caught up.</b><span>New activity will appear here.</span></div>}{unreadCount > rows.filter((row) => !row.read_at).length && <p className="notification-more-unread">{unreadCount - rows.filter((row) => !row.read_at).length} older unread notifications</p>}<div className="notification-page-list">{rows.map((item) => <button key={item.id} className={`notification-row ${item.read_at ? '' : 'is-unread'}`} onClick={() => void open(item)}><span className="notification-avatar">{item.actor?.avatar_url ? <img src={avatarUrl(item.actor.avatar_url) ?? ''} alt=""/> : <Bell size={16}/>}</span><span className="notification-copy"><span><b>{item.actor?.display_name ?? 'A film lover'}</b> {notificationVerb(item.kind)}</span><time>{formatNotificationDate(item.created_at)}</time></span>{!item.read_at && <i aria-label="Unread"/>}</button>)}</div></section>;
}

