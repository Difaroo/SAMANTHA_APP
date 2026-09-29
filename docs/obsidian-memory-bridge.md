# Obsidian Memory Bridge

## Outcome
Samantha can write structured markdown memory notes into David's Obsidian vault, conventionally at `$HOME/Samantha/wiki`.

## Command
```bash
npm run memory:write -- --type decision --title "Title" --body "Markdown body"
```

Supported note types:
- `decision`
- `concept`
- `idea`
- `conversation-summary`

Useful options:
- `--tag <tag>` repeatable frontmatter tag
- `--link "[[Wiki Link]]"` repeatable Obsidian link
- `--vault <path>` override vault path
- `--root <folder>` override folder inside the vault
- `--no-sync` write locally without running Obsidian Headless sync
- `--dry-run` print the note path and markdown without writing

## Behavior
The tool writes notes under:

```text
<vault>/Samantha Memory/<type>/<YYYY-MM-DD>-<slug>.md
```

Every note includes frontmatter for `title`, `type`, `created`, `tags`, `links`, and `source`.

After a real write, the tool runs:

```bash
ob sync --path "$HOME/Samantha/wiki"
```

## Current Machine State
`obsidian-headless` is installed as `ob` version `0.0.12`.

This Mac has Homebrew Node 26 as the default `node`, but `obsidian-headless` requires Node 20-25 through its native dependency chain. The bridge prepends `/opt/homebrew/opt/node@22/bin` for `ob` calls when that path exists.

Obsidian Sync was not configured for the vault at the 2.4.0 verification point; `ob sync-status --path "$HOME/Samantha/wiki"` reported no sync configuration. Local vault writes worked, but encrypted Obsidian Sync required login and `ob sync-setup` before end-to-end sync could be called complete.

The current bridge source retains a legacy machine-specific default vault path. Use `--vault "$HOME/Samantha/wiki"` on the original layout and replace the source default with runtime home discovery before using it on another machine.

## Verification
```bash
npm run test:memory
npm run lint
npm run build
```
