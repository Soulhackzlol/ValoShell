# Community looks

Looks players share with everyone. ValoShell's look gallery (Studio → Theme → Browse looks →
Community) lists every look here and applies one in a click.

## Share yours

1. In ValoShell, open the look gallery and press **Share to community**. Give it a name, the
   credit you want (or leave it blank), and a line about it.
2. ValoShell copies the look and opens GitHub's "new file" page in `community/looks/`.
   Paste, then **Propose changes**. GitHub makes the pull request for you (you need a free
   GitHub account).
3. A check runs on the pull request. Once it is merged, the look shows in everyone's gallery.

## Rules

- One look per file, named `your-look-name.json` (lowercase letters, digits, dashes).
- It needs a `community` block: `name` (up to 48 characters), `author` (up to 40) and
  `description` (up to 200).
- No web links. A shared look may not load images, videos or pages from other sites.
- Under 512 KB.

Check locally with `python community/build_index.py --check`. Don't edit `index.json` or
`thumbs/` by hand: after each merge a workflow screenshots the new look for its gallery card
(`node ui/scripts/look-thumbs.mjs community <id>`, with `npm run ui:dev` running) and rebuilds
the index.
