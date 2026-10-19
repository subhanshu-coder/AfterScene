import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, Film, Heart, LoaderCircle, UserRoundCheck, UserRoundPlus } from 'lucide-react';
import { avatarUrl } from '../lib/avatar';
import { supabase } from '../lib/supabase';

type Props = { profileId: string; userId: string; onBack: () => void; onToast: (message: string) => void; onOpenProfile: (id: string) => void };
type Profile = { id: string; username: string; display_name: string; bio: string; avatar_url: string | null; is_private: boolean };
type ProfilePost = { id: string; kind: string; body: string | null; is_spoiler: boolean; image_path: string | null; created_at: string };
type ProfileReview = { id: string; title: string | null; body: string; rating: number; created_at: string; movie_id: string };
type LinkProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

export default function ProfilePage({ profileId, userId, onBack, onToast, onOpenProfile }: Props) {
  const client = useQueryClient();
  const [tab, setTab] = useState<'posts' | 'reviews' | 'followers' | 'following'>('posts');
  const [uploading, setUploading] = useState(false);
  const ownProfile = profileId === userId;
  const profile = useQuery({
    queryKey: ['profile-page', profileId, userId],
    enabled: Boolean(supabase),
    queryFn: async () => {
      if (!supabase) throw new Error('Profile service is not configured.');
      const [{ data: user, error: userError }, { data: posts, error: postsError }, { data: reviews, error: reviewsError }, { count: followers, error: followersError }, { count: following, error: followingError }, { data: follow, error: followError }] = await Promise.all([
        supabase.from('profiles').select('id,username,display_name,bio,avatar_url,is_private').eq('id', profileId).single(),
        supabase.from('posts').select('id,kind,body,is_spoiler,image_path,created_at').eq('author_id', profileId).order('created_at', { ascending: false }).limit(50),
        supabase.from('reviews').select('id,title,body,rating,created_at,movie_id').eq('author_id', profileId).order('created_at', { ascending: false }).limit(50),
        supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followed_id', profileId),
        supabase.from('follows').select('followed_id', { count: 'exact', head: true }).eq('follower_id', profileId),
        !ownProfile ? supabase.from('follows').select('followed_id').eq('follower_id', userId).eq('followed_id', profileId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      const error = userError ?? postsError ?? reviewsError ?? followersError ?? followingError ?? followError;
      if (error) throw new Error(error.message || 'This profile could not be loaded.');
      if (!user) throw new Error('This profile is not available.');
      return { user: user as Profile, posts: (posts ?? []) as ProfilePost[], reviews: (reviews ?? []) as ProfileReview[], followers: followers ?? 0, following: following ?? 0, isFollowing: Boolean(follow) };
    },
  });
  const linkedProfiles = useQuery({
    queryKey: ['profile-links', profileId, tab],
    enabled: Boolean(supabase && (tab === 'followers' || tab === 'following')),
    queryFn: async () => {
      if (!supabase) return [] as LinkProfile[];
      const column = tab === 'followers' ? 'follower_id' : 'followed_id';
      const { data: links, error } = await supabase.from('follows').select('follower_id,followed_id').eq(tab === 'followers' ? 'followed_id' : 'follower_id', profileId).order('created_at', { ascending: false }).limit(100);
      if (error) throw new Error('This list could not be loaded.');
      const ids = [...new Set((links ?? []).map((link) => link[column]))];
      if (!ids.length) return [] as LinkProfile[];
      const { data, error: profileError } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids);
      if (profileError) throw new Error('This list could not be loaded.');
      const byId = new Map(((data ?? []) as LinkProfile[]).map((item) => [item.id, item]));
      return ids.map((id) => byId.get(id)).filter((item): item is LinkProfile => Boolean(item));
    },
  });

  async function toggleFollow() {
    if (!supabase || !profile.data || ownProfile) return;
    const result = profile.data.isFollowing
      ? await supabase.from('follows').delete().eq('follower_id', userId).eq('followed_id', profileId)
      : await supabase.from('follows').insert({ follower_id: userId, followed_id: profileId });
    if (result.error) return onToast('Could not update your follow. Please try again.');
    await client.invalidateQueries({ queryKey: ['profile-page', profileId] });
    await client.invalidateQueries({ queryKey: ['profile-links', profileId] });
  }

  async function uploadAvatar(file?: File) {
    if (!file || !supabase || !ownProfile) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      onToast('Choose a JPG, PNG, or WebP image under 5 MB.');
      return;
    }
    setUploading(true);
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(objectPath, file, { contentType: file.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { error: saveError } = await supabase.from('profiles').update({ avatar_url: objectPath, updated_at: new Date().toISOString() }).eq('id', userId);
      if (saveError) {
        await supabase.storage.from('avatars').remove([objectPath]);
        throw saveError;
      }
      const { data: saved, error: verifyError } = await supabase.from('profiles').select('avatar_url').eq('id', userId).single();
      if (verifyError || saved?.avatar_url !== objectPath) throw verifyError ?? new Error('The profile photo did not save.');
      await client.invalidateQueries({ queryKey: ['profile-page', profileId] });
      await client.invalidateQueries({ queryKey: ['my-profile', userId] });
      onToast('Profile photo updated.');
    } catch {
      onToast('Could not save your profile photo. Check the avatar storage setup and try again.');
    } finally {
      setUploading(false);
    }
  }

  if (profile.isPending) return <section className="profile-page"><p className="community-state" role="status" aria-live="polite">Loading profile…</p></section>;
  if (profile.isError || !profile.data) return <section className="profile-page"><button className="profile-back" onClick={onBack}><ArrowLeft size={17}/> Back</button><div className="community-error-panel" role="alert"><b>Profile unavailable</b><span>{profile.error?.message ?? 'This profile could not be loaded.'}</span><button onClick={() => void profile.refetch()}>Try again</button></div></section>;
  const person = profile.data.user;

  return <section className="profile-page">
    <button className="profile-back" onClick={onBack}><ArrowLeft size={17}/> Back to {ownProfile ? 'home' : 'community'}</button>
    <header className="profile-hero">
      <div className="profile-avatar-wrap">
        <span className="profile-page-avatar">{person.avatar_url ? <img src={avatarUrl(person.avatar_url) ?? ''} alt={`${person.display_name}'s profile`} loading="lazy" decoding="async" /> : person.display_name.slice(0, 1).toUpperCase()}</span>
        {ownProfile && <label className="profile-avatar-upload" aria-label="Upload profile photo">{uploading ? <LoaderCircle className="spinning" size={17}/> : <Camera size={17}/>}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ''; }}/></label>}
      </div>
      <div className="profile-hero-copy"><span className="profile-kicker">{ownProfile ? 'YOUR FILM IDENTITY' : 'AFTERSCENE MEMBER'}</span><h1>{person.display_name}</h1><p className="profile-handle">@{person.username}</p><p className="profile-bio">{person.bio || 'Movie lover, collecting stories one scene at a time.'}</p></div>
      {!ownProfile && <button className="profile-follow-button" aria-pressed={profile.data.isFollowing} onClick={() => void toggleFollow()}>{person.is_private ? <UserRoundPlus size={16}/> : profile.data.isFollowing ? <UserRoundCheck size={16}/> : <UserRoundPlus size={16}/>} {profile.data.isFollowing ? 'Following' : 'Follow'}</button>}
    </header>
    <div className="profile-stats" role="group" aria-label="Profile posts, followers, following, and reviews">
      <button type="button" aria-pressed={tab === 'posts'} className={tab === 'posts' ? 'selected' : ''} onClick={() => setTab('posts')}><b>{profile.data.posts.length}</b><span>Posts</span></button>
      <button type="button" aria-pressed={tab === 'followers'} className={tab === 'followers' ? 'selected' : ''} onClick={() => setTab('followers')}><b>{profile.data.followers}</b><span>Followers</span></button>
      <button type="button" aria-pressed={tab === 'following'} className={tab === 'following' ? 'selected' : ''} onClick={() => setTab('following')}><b>{profile.data.following}</b><span>Following</span></button>
      <button type="button" aria-pressed={tab === 'reviews'} className={tab === 'reviews' ? 'selected' : ''} onClick={() => setTab('reviews')}><b>{profile.data.reviews.length}</b><span>Reviews</span></button>
    </div>
    {(tab === 'posts' || tab === 'reviews') && <div className="profile-posts">
      <div className="profile-section-title"><Film size={17}/><h2>{tab === 'posts' ? 'Recent posts' : 'Movie reviews'}</h2></div>
      {tab === 'posts' && profile.data.posts.map((post) => <article className="profile-post" key={post.id}><small>{post.kind} · <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></small>{post.is_spoiler ? <details><summary>Spoiler — reveal post</summary><p>{post.body}</p></details> : <p>{post.body || 'Shared a photo'}</p>}{post.image_path && supabase && <img className="profile-post-image" src={supabase.storage.from('post-images').getPublicUrl(post.image_path).data.publicUrl} alt="Post attachment" loading="lazy"/>}</article>)}
      {tab === 'reviews' && profile.data.reviews.map((review) => <article className="profile-post" key={review.id}><small>★ {Number(review.rating).toFixed(1)} · <time dateTime={review.created_at}>{new Date(review.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></small>{review.title && <h3>{review.title}</h3>}<p>{review.body}</p></article>)}
      {((tab === 'posts' && !profile.data.posts.length) || (tab === 'reviews' && !profile.data.reviews.length)) && <div className="profile-empty"><Heart size={21}/><b>{tab === 'posts' ? 'No public posts yet.' : 'No reviews yet.'}</b></div>}
    </div>}
    {(tab === 'followers' || tab === 'following') && <div className="profile-posts"><div className="profile-section-title"><Heart size={17}/><h2>{tab === 'followers' ? 'Followers' : 'Following'}</h2></div>{linkedProfiles.isPending && <p className="community-state">Loading people…</p>}{linkedProfiles.isError && <p className="community-state community-error">{linkedProfiles.error.message}</p>}{!linkedProfiles.isPending && !linkedProfiles.data?.length && <div className="profile-empty"><Heart size={21}/><b>No {tab} yet.</b></div>}{linkedProfiles.data?.map((link) => <button className="profile-link-row" key={link.id} onClick={() => onOpenProfile(link.id)}><span>{link.avatar_url ? <img src={avatarUrl(link.avatar_url) ?? ''} alt=""/> : link.display_name.slice(0, 1).toUpperCase()}</span><b>{link.display_name}</b><small>@{link.username}</small></button>)}</div>}
  </section>;
}

