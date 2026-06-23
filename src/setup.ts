#!/usr/bin/env node
import * as p from "@clack/prompts";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const MCP_NAME = "mattermost-boards";
const MCP_COMMAND = "npx";
const MCP_ARGS = ["-y", "mcp-boards-nk@latest"];

function getClaudeDesktopConfigPath(): string {
  switch (process.platform) {
    case "win32":
      return path.join(process.env.APPDATA ?? os.homedir(), "Claude", "claude_desktop_config.json");
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
    default:
      return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
  }
}

function getCursorConfigPath(): string {
  switch (process.platform) {
    case "win32":
      return path.join(os.homedir(), ".cursor", "mcp.json");
    case "darwin":
      return path.join(os.homedir(), ".cursor", "mcp.json");
    default:
      return path.join(os.homedir(), ".cursor", "mcp.json");
  }
}

function writeJsonConfig(configPath: string, url: string, token: string) {
  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      config = {};
    }
  }
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers[MCP_NAME] = {
    command: MCP_COMMAND,
    args: MCP_ARGS,
    env: {
      MATTERMOST_URL: url,
      MATTERMOST_TOKEN: token,
    },
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function installClaudeCode(scope: string, url: string, token: string) {
  const scopeFlag = scope === "global" ? "--global" : "--project";
  const cmd = [
    "claude mcp add",
    scopeFlag,
    MCP_NAME,
    `-e MATTERMOST_URL=${url}`,
    `-e MATTERMOST_TOKEN=${token}`,
    "--",
    MCP_COMMAND,
    ...MCP_ARGS,
  ].join(" ");
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  console.log();
  p.intro("  mcp-boards-nk — Mattermost Boards MCP installer  ");

  const client = await p.select({
    message: "¿En qué cliente querés instalar el MCP?",
    options: [
      { value: "claude-desktop", label: "Claude Desktop" },
      { value: "claude-code", label: "Claude Code (CLI)" },
      { value: "cursor", label: "Cursor" },
    ],
  });
  if (p.isCancel(client)) { p.cancel("Instalación cancelada."); process.exit(0); }

  let scope = "global";
  if (client === "claude-code") {
    const s = await p.select({
      message: "¿Instalación global o por proyecto?",
      options: [
        { value: "global", label: "Global (~/.claude/settings.json)" },
        { value: "project", label: "Proyecto (.claude/settings.json)" },
      ],
    });
    if (p.isCancel(s)) { p.cancel("Instalación cancelada."); process.exit(0); }
    scope = s as string;
  }

  const url = await p.text({
    message: "URL de tu instancia de Mattermost",
    placeholder: "https://mattermost.tuempresa.com",
    validate: (v) => (!v || !v.startsWith("http") ? "Debe ser una URL válida (https://...)" : undefined),
  });
  if (p.isCancel(url)) { p.cancel("Instalación cancelada."); process.exit(0); }

  const token = await p.password({
    message: "Personal Access Token de Mattermost",
    validate: (v) => (!v || v.length < 10 ? "Token demasiado corto" : undefined),
  });
  if (p.isCancel(token)) { p.cancel("Instalación cancelada."); process.exit(0); }

  const spinner = p.spinner();
  spinner.start("Instalando...");

  try {
    if (client === "claude-desktop") {
      const configPath = getClaudeDesktopConfigPath();
      writeJsonConfig(configPath, url as string, token as string);
      spinner.stop(`Config escrita en: ${configPath}`);
    } else if (client === "claude-code") {
      installClaudeCode(scope, url as string, token as string);
      spinner.stop("Instalado en Claude Code.");
    } else if (client === "cursor") {
      const configPath = getCursorConfigPath();
      writeJsonConfig(configPath, url as string, token as string);
      spinner.stop(`Config escrita en: ${configPath}`);
    }

    p.outro(`✓ listo. Reiniciá ${client === "claude-code" ? "Claude Code" : "la app"} para activar el MCP.`);
  } catch (err: any) {
    spinner.stop("Error durante la instalación.");
    p.log.error(err.message ?? String(err));
    process.exit(1);
  }
}

main();
