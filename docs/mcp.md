# Connect an AI assistant (MCP)

Drive speaks the [Model Context Protocol](https://modelcontextprotocol.io). An AI assistant such as Claude Code, Claude.ai or Cursor can browse, search and read your drive, and the owner's assistant can also organize it.

The assistant never gets a password. The first time it connects, your browser opens your drive: you sign in as usual, a page shows which app is asking and what it will be able to do, and you choose Allow or Deny. From then on the assistant acts as you, with exactly your rights, and you can take them back at any time.

Your drive must be served over HTTPS, which is the case with a domain name (`install.sh --domain`). Over plain HTTP on an IP address (`install.sh --ip`), the MCP endpoint is turned off: access tokens would travel in clear text. On `localhost` it works, for development.

In the examples below, replace `https://drive.example.com` with the address of your drive.

## Claude Code

```bash
claude mcp add --transport http drive https://drive.example.com/mcp
```

Then run `/mcp` in Claude Code, pick `drive` and authenticate. Your browser opens the sign-in page of your drive, then the consent page.

## Claude.ai

In Settings, Connectors, choose "Add custom connector" and enter `https://drive.example.com/mcp`. Leave the OAuth client ID and secret empty: Claude registers itself. Then click Connect and allow access. Claude.ai connects from Anthropic's servers, so your drive must be reachable from the internet.

## Cursor

Add the server to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "drive": { "url": "https://drive.example.com/mcp" }
  }
}
```

Cursor then shows the server as needing a login: click it to open the consent page.

## Other clients

Any client that supports the Streamable HTTP transport and MCP authorization works. It will find everything on its own from the `401` answer of `/mcp`, but here are the details:

| What | Where |
|---|---|
| MCP endpoint | `POST /mcp`, stateless, JSON responses |
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource` (also `/.well-known/oauth-protected-resource/mcp`) |
| Authorization server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` (also `/.well-known/oauth-authorization-server/api/auth`) |
| Dynamic client registration (RFC 7591) | `POST /api/auth/oauth2/register`, public clients (`token_endpoint_auth_method: none`) or confidential ones |
| Authorization and token | `/api/auth/oauth2/authorize` with PKCE (S256 only), `/api/auth/oauth2/token` |

Send the resource indicator `resource=https://drive.example.com/mcp` (RFC 8707) when authorizing: `/mcp` refuses tokens issued for anything else. The only scope is `offline_access`, which brings a refresh token. Access tokens last one hour, refresh tokens thirty days. Bearer and DPoP-bound tokens are both accepted.

## What an assistant can do

The assistant acts as the person who allowed it, and every rule of the app applies unchanged.

| Tool | Owner | Reader | What it does |
|---|---|---|---|
| `list_folder` | yes | yes | Lists a folder. Without a folder: My Drive for the owner, what was shared with them for a reader. |
| `search` | yes | yes | Same search as the app: words, `type:`, `after:`, `before:`, `in:`, and for the owner `access:`, `shared:`, `tag:`. |
| `get_item` | yes | yes | Details and location of an item; for the owner, who it is shared with and how often it was viewed. |
| `read_file` | yes | yes | Text of text files, text extracted from PDF, Word, Excel, PowerPoint and HTML files, and images. |
| `create_folder` | yes | no | Creates a folder. |
| `upload_text_file` | yes | no | Saves text as a file, up to 1 MB. |
| `rename` | yes | no | Renames a file or folder. |
| `move` | yes | no | Moves files and folders. |
| `move_to_trash` | yes | no | Moves items to the trash, from where the owner can restore them. |
| `list_activity` | yes | no | The activity journal, for the whole drive or one item. |

A reader's assistant does not even see the owner's tools, and calling one fails.

Reading follows the same rule as the preview in the app: being able to open an item is enough to read its text. An image, though, is handed over as the file itself, so it also needs the right to download: when the owner turned downloading off for a share, the assistant gets the text of documents but not the images. Long texts come in parts of up to 200,000 characters. Documents over 25 MB and images over 5 MB are not read.

No assistant can share an item, change who has access to it or delete anything for good. Keep in mind that moving an item into a shared folder shares it with the people of that folder, as in the app.

What a reader's assistant reads shows up in the owner's activity journal, as "Alice via Claude Code" for instance. The owner's own assistant is treated like the owner: its reads are not journaled, but the files it read appear among the recent ones.

## Revoke access

Each person manages the assistants they allowed:

- `GET /api/connected-apps` lists them, with the date they were allowed;
- `DELETE /api/connected-apps/<clientId>` revokes one.

A revoked assistant stops working on its next request and has to ask for consent again. Disabling or deleting a reader, or changing their password, also revokes all their assistants. Removing the server from the assistant (for example `claude mcp remove drive`) only forgets the token on that side: revoke it in Drive as well.
