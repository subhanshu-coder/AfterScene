# Community privacy and spoiler behavior

## Spoiler-marked posts

Authors can mark a community post as containing spoilers. The marker is stored in the post's `is_spoiler` field. In community and profile views, spoiler-marked post text and attachments stay behind an explicit disclosure control until a reader opens it. The disclosure does not alter the author's stored content.

This is a reader-side presentation feature, not access control: a spoiler marker does not make a public post private. Follow the usual post visibility and row-level security policies for private content.

## Realtime subscriptions

Community subscriptions are opened only for the currently visible Feed, Discussions, Trending, Reviews, or Collections lane. Keep subscriptions to the tables needed by that lane, debounce bursts before invalidating cached queries, and remove the channel and pending timers on cleanup. Do not add a global subscription for every signed-in session.

## Bounded community reads

Community queries cap post, comment, review-reply, and collection-item reads. Preserve those caps when editing the feed; use cursor pagination for deeper history. Avoid loading private messages or unrelated profile data through public community subscriptions.
