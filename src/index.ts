#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.MATTERMOST_URL ?? "";
const TOKEN = process.env.MATTERMOST_TOKEN ?? "";
const API = `${BASE_URL}/plugins/focalboard/api/v2`;

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/json",
  };
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Focalboard API error ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

const server = new McpServer({
  name: "mcp-focalboard",
  version: "1.0.0",
});

// ── Teams ─────────────────────────────────────────────────────────────────────

server.tool("list_teams", "Lista todos los teams/workspaces de Mattermost Boards", { _dummy: z.string().optional() }, async () => {
  const teams = await apiFetch("/teams");
  const text = teams.map((t: any) => `- ${t.title} (id: ${t.id})`).join("\n");
  return { content: [{ type: "text", text: `Teams:\n${text}` }] };
});

// ── Boards ────────────────────────────────────────────────────────────────────

server.tool(
  "list_boards",
  "Lista los boards de un team",
  { team_id: z.string().describe("ID del team") },
  async ({ team_id }) => {
    const boards = await apiFetch(`/teams/${team_id}/boards`);
    const text = boards
      .map((b: any) => `- ${b.title} (id: ${b.id})${b.description ? ` — ${b.description}` : ""}`)
      .join("\n");
    return { content: [{ type: "text", text: `Boards:\n${text}` }] };
  }
);

server.tool(
  "get_board",
  "Obtiene detalles de un board incluyendo sus propiedades/columnas",
  { board_id: z.string().describe("ID del board") },
  async ({ board_id }) => {
    const board = await apiFetch(`/boards/${board_id}`);
    const props = (board.cardProperties ?? [])
      .map((p: any) => {
        const opts = (p.options ?? []).map((o: any) => `    - ${o.value} (id: ${o.id})`).join("\n");
        return `  ${p.name} [${p.type}] (id: ${p.id})\n${opts}`;
      })
      .join("\n");
    const text = `Board: ${board.title}\nID: ${board.id}\nDescripción: ${board.description ?? ""}\n\nPropiedades:\n${props}`;
    return { content: [{ type: "text", text }] };
  }
);

// ── Cards ─────────────────────────────────────────────────────────────────────

server.tool(
  "list_cards",
  "Lista las cards/tareas de un board",
  {
    board_id: z.string().describe("ID del board"),
    page: z.number().optional().describe("Página (default 0)"),
    per_page: z.number().optional().describe("Cards por página (default 50)"),
  },
  async ({ board_id, page = 0, per_page = 50 }) => {
    const cards = await apiFetch(`/boards/${board_id}/cards?page=${page}&per_page=${per_page}`);
    if (!cards?.length) return { content: [{ type: "text", text: "No hay cards en este board." }] };
    const text = cards
      .map((c: any) => {
        const props = Object.entries(c.fields?.properties ?? {})
          .map(([k, v]) => `    ${k}: ${v}`)
          .join("\n");
        return `- ${c.title} (id: ${c.id})\n${props}`;
      })
      .join("\n");
    return { content: [{ type: "text", text: `Cards:\n${text}` }] };
  }
);

server.tool(
  "get_card",
  "Obtiene el detalle completo de una card",
  { card_id: z.string().describe("ID de la card") },
  async ({ card_id }) => {
    const card = await apiFetch(`/cards/${card_id}`);
    const props = JSON.stringify(card.fields?.properties ?? {}, null, 2);
    const text = `Card: ${card.title}\nID: ${card.id}\nBoard: ${card.boardId}\nContenido: ${card.fields?.content ?? ""}\nPropiedades:\n${props}`;
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "create_card",
  "Crea una nueva card/tarea en un board",
  {
    board_id: z.string().describe("ID del board"),
    title: z.string().describe("Título de la card"),
    properties: z
      .record(z.string(), z.string())
      .optional()
      .describe('Propiedades como objeto JSON, ej: {"prop_estado": "opt_pendiente"}'),
    content: z.string().optional().describe("Contenido/descripción de la card"),
  },
  async ({ board_id, title, properties = {}, content }) => {
    const body: any = {
      title,
      boardId: board_id,
      fields: { properties, content: content ?? "" },
    };
    const card = await apiFetch(`/boards/${board_id}/cards`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: `Card creada: ${card.title} (id: ${card.id})` }] };
  }
);

server.tool(
  "update_card",
  "Actualiza el título, propiedades o contenido de una card existente",
  {
    card_id: z.string().describe("ID de la card a actualizar"),
    title: z.string().optional().describe("Nuevo título"),
    properties: z
      .record(z.string(), z.string())
      .optional()
      .describe('Propiedades a actualizar como objeto JSON, ej: {"prop_estado": "opt_completado"}'),
    content: z.string().optional().describe("Nuevo contenido/descripción"),
  },
  async ({ card_id, title, properties, content }) => {
    const current = await apiFetch(`/cards/${card_id}`);
    const updatedFields: any = {};
    if (properties) updatedFields.properties = { ...current.properties, ...properties };
    if (content !== undefined) updatedFields.content = content;
    if (Object.keys(updatedFields).length > 0) {
      await apiFetch(`/boards/${current.boardId}/blocks/${card_id}`, {
        method: "PATCH",
        body: JSON.stringify({ updatedFields }),
      });
    }
    if (title) {
      await apiFetch(`/cards/${card_id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, properties: current.properties }),
      });
    }
    return { content: [{ type: "text", text: `Card ${card_id} actualizada correctamente.` }] };
  }
);

server.tool(
  "delete_card",
  "Elimina una card de un board",
  {
    board_id: z.string().describe("ID del board al que pertenece la card"),
    card_id: z.string().describe("ID de la card a eliminar"),
  },
  async ({ board_id, card_id }) => {
    await apiFetch(`/boards/${board_id}/blocks/${card_id}`, { method: "DELETE" });
    return { content: [{ type: "text", text: `Card ${card_id} eliminada.` }] };
  }
);

// ── Views ─────────────────────────────────────────────────────────────────────

server.tool(
  "list_views",
  "Lista las vistas de un board (tablero, tabla, galería, etc.)",
  { board_id: z.string().describe("ID del board") },
  async ({ board_id }) => {
    const views = await apiFetch(`/boards/${board_id}/views`);
    const text = views.map((v: any) => `- ${v.title} [${v.fields?.viewType}] (id: ${v.id})`).join("\n");
    return { content: [{ type: "text", text: `Vistas:\n${text}` }] };
  }
);

// ── Members ───────────────────────────────────────────────────────────────────

server.tool(
  "list_board_members",
  "Lista los miembros de un board",
  { board_id: z.string().describe("ID del board") },
  async ({ board_id }) => {
    const members = await apiFetch(`/boards/${board_id}/members`);
    const text = members.map((m: any) => `- userId: ${m.userId} | roles: ${m.roles}`).join("\n");
    return { content: [{ type: "text", text: `Miembros:\n${text}` }] };
  }
);

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  if (!BASE_URL || !TOKEN) {
    process.stderr.write("Error: MATTERMOST_URL y MATTERMOST_TOKEN son requeridos\n");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("mcp-focalboard iniciado\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
