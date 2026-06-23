# mcp-boards-nk

[![npm version](https://img.shields.io/npm/v/mcp-boards-nk.svg)](https://www.npmjs.com/package/mcp-boards-nk)
[![npm downloads](https://img.shields.io/npm/dm/mcp-boards-nk.svg)](https://www.npmjs.com/package/mcp-boards-nk)
[![CI](https://github.com/nikodev-documentacion/mcp-boards-nk/actions/workflows/ci.yml/badge.svg)](https://github.com/nikodev-documentacion/mcp-boards-nk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

MCP server for **Mattermost Boards (Focalboard)** — lets Claude and other MCP-compatible clients list teams, boards, and cards, create and update tasks, add comments, and more — all via natural language.

> The first MCP server with full support for Mattermost Boards (Focalboard).

![mcp-boards-nk demo](https://raw.githubusercontent.com/nikodev-documentacion/mcp-boards-nk/main/mcp-demo.gif)

## Tools available

| Tool | Description |
|------|-------------|
| `list_teams` | List all Mattermost teams |
| `list_boards` | List boards in a team |
| `get_board` | Get board details including properties and columns |
| `list_cards` | List cards/tasks in a board |
| `get_card` | Get full card details |
| `create_card` | Create a new card with title, properties and content |
| `update_card` | Update title, properties or content of an existing card |
| `delete_card` | Delete a card from a board |
| `add_comment` | Add a comment to a card |
| `list_views` | List views of a board (kanban, table, gallery…) |
| `list_board_members` | List members of a board |

## Requirements

- Self-hosted Mattermost instance with the **Boards (Focalboard) plugin** enabled
- A Mattermost **Personal Access Token**

## Installation

### Wizard (recommended)

```bash
npx --package=mcp-boards-nk mcp-boards-nk-setup
```

Supports Claude Desktop, Claude Code (global or project) and Cursor. Prompts for your Mattermost URL and token, writes the config automatically.

### Manual — Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mattermost-boards": {
      "command": "npx",
      "args": ["-y", "mcp-boards-nk@latest"],
      "env": {
        "MATTERMOST_URL": "https://your-mattermost-instance.com",
        "MATTERMOST_TOKEN": "your-personal-access-token"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add mattermost-boards -- env MATTERMOST_URL=https://your-mattermost-instance.com MATTERMOST_TOKEN=your-token npx -y mcp-boards-nk@latest
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MATTERMOST_URL` | ✅ | Base URL of your Mattermost instance (no trailing slash) |
| `MATTERMOST_TOKEN` | ✅ | Personal access token of the Mattermost user |

## Getting a Personal Access Token

1. Go to **Profile → Security → Personal Access Tokens → Edit**
2. Click **Create Token**, give it a name, copy the value
3. If the option doesn't appear, ask your Mattermost admin to enable it under **System Console → User Management → Users → Manage Roles → Allow this account to generate personal access tokens**

## How to use card properties

When creating or updating cards, pass `properties` as a JSON object using the IDs defined in the board.
Use `get_board` to see all available property IDs and their option values.

Example:
```json
{
  "prop_estado": "opt_pendiente"
}
```

## License

MIT
