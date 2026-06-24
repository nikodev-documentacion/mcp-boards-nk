#!/usr/bin/env node
import * as p from "@clack/prompts";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const MCP_NAME = "mattermost-boards";

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
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

function isClaudeRunning(): boolean {
  try {
    if (process.platform === "win32") {
      const out = execSync("tasklist", { encoding: "utf-8" });
      return out.toLowerCase().includes("claude");
    } else {
      execSync("pgrep -x Claude", { stdio: "ignore" });
      return true;
    }
  } catch {
    return false;
  }
}

function readConfig(configPath: string): any {
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = fs.readFileSync(configPath, "utf-8").replace(/^﻿/, "").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`No se pudo parsear el archivo existente: ${configPath}`);
  }
}

function writeConfig(configPath: string, config: any): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

function installViaJsonConfig(configPath: string, url: string, token: string, appName: string) {
  let config: any;
  try {
    config = readConfig(configPath);
  } catch (err: any) {
    throw new Error(err.message);
  }

  if (config?.mcpServers?.[MCP_NAME]) {
    return { alreadyExists: true, config };
  }

  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers[MCP_NAME] = {
    command: "npx",
    args: ["-y", "mcp-boards-nk@latest"],
    env: {
      MATTERMOST_URL: url,
      MATTERMOST_TOKEN: token,
    },
  };

  writeConfig(configPath, config);
  return { alreadyExists: false, config };
}

export async function runSetup() {
  console.log();
  p.intro("  MCP Boards — Setup wizard  ");

  // 1. Seleccionar cliente
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
        { value: "global", label: "Global  (~/.claude/settings.json)" },
        { value: "project", label: "Proyecto  (.claude/settings.json)" },
      ],
    });
    if (p.isCancel(s)) { p.cancel("Instalación cancelada."); process.exit(0); }
    scope = s as string;
  }

  // 2. Si es Claude Desktop: verificar que esté cerrado
  if (client === "claude-desktop" && isClaudeRunning()) {
    p.log.warn("Claude Desktop está corriendo. Cerralo antes de continuar.");
    const confirmed = await p.confirm({
      message: "¿Ya cerraste Claude Desktop?",
      initialValue: false,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cerrá Claude Desktop y volvé a correr el wizard.");
      process.exit(0);
    }
  }

  // 3. Verificar entrada existente para Desktop/Cursor
  if (client === "claude-desktop" || client === "cursor") {
    const configPath = client === "claude-desktop" ? getClaudeDesktopConfigPath() : getCursorConfigPath();
    const existing = readConfig(configPath);
    if (existing?.mcpServers?.[MCP_NAME]) {
      const overwrite = await p.confirm({
        message: `Ya existe una entrada "${MCP_NAME}". ¿Sobreescribirla?`,
        initialValue: false,
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel("Instalación cancelada. La configuración existente no fue modificada.");
        process.exit(0);
      }
    }
  }

  // 4. Pedir URL
  const url = await p.text({
    message: "URL del servidor Mattermost",
    placeholder: "https://mattermost.tuempresa.com",
    validate: (v) => {
      if (!v) return "La URL es requerida";
      if (!v.startsWith("https://") && !v.startsWith("http://")) return "La URL debe empezar con https://";
    },
  });
  if (p.isCancel(url)) { p.cancel("Instalación cancelada."); process.exit(0); }

  // 5. Pedir token
  const token = await p.password({
    message: "Token de acceso personal de Mattermost",
    validate: (v) => {
      if (!v || v.length < 10) return "Token inválido o demasiado corto";
    },
  });
  if (p.isCancel(token)) { p.cancel("Instalación cancelada."); process.exit(0); }

  const cleanUrl = (url as string).replace(/\/$/, "");
  const cleanToken = token as string;

  const spinner = p.spinner();
  spinner.start("Instalando...");

  try {
    if (client === "claude-desktop") {
      const configPath = getClaudeDesktopConfigPath();
      let config = readConfig(configPath);
      config.mcpServers = config.mcpServers ?? {};
      config.mcpServers[MCP_NAME] = {
        command: "npx",
        args: ["-y", "mcp-boards-nk@latest"],
        env: { MATTERMOST_URL: cleanUrl, MATTERMOST_TOKEN: cleanToken },
      };
      writeConfig(configPath, config);
      spinner.stop(`Configuración escrita en:\n  ${configPath}`);
      p.outro("Abrí Claude Desktop nuevamente para activar el MCP.");

    } else if (client === "claude-code") {
      const cmd = [
        "claude mcp add",
        `-s ${scope}`,
        MCP_NAME,
        `-e MATTERMOST_URL=${cleanUrl}`,
        `-e MATTERMOST_TOKEN=${cleanToken}`,
        "--",
        "npx", "-y", "mcp-boards-nk@latest",
      ].join(" ");
      execSync(cmd, { stdio: "inherit" });
      spinner.stop("Instalado en Claude Code.");
      p.outro("El MCP está activo. Podés verificarlo con: claude mcp list");

    } else if (client === "cursor") {
      const configPath = getCursorConfigPath();
      let config = readConfig(configPath);
      config.mcpServers = config.mcpServers ?? {};
      config.mcpServers[MCP_NAME] = {
        command: "npx",
        args: ["-y", "mcp-boards-nk@latest"],
        env: { MATTERMOST_URL: cleanUrl, MATTERMOST_TOKEN: cleanToken },
      };
      writeConfig(configPath, config);
      spinner.stop(`Configuración escrita en:\n  ${configPath}`);
      p.outro("Reiniciá Cursor para activar el MCP.");
    }
  } catch (err: any) {
    spinner.stop("Error durante la instalación.");
    p.log.error(err.message ?? String(err));
    process.exit(1);
  }
}

runSetup();
