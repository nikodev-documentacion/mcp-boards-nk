# mcp-boards-nk

MCP server for **Mattermost Boards (Focalboard)** — lets Claude and other MCP-compatible clients list teams, boards, cards, and create, update or delete tasks via natural language.

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
| `list_views` | List views of a board (kanban, table, gallery…) |
| `list_board_members` | List members of a board |

## Requirements

- Mattermost instance with the **Boards (Focalboard) plugin** enabled
- A Mattermost **Personal Access Token** with permission to access boards

## Installation

### Claude Desktop

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
3. If the option doesn't appear, ask your Mattermost admin to enable it under **System Console → User Management → Users → Manage Roles**

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
