#!/usr/bin/env node
import * as p from "@clack/prompts";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const MCP_NAME = "mattermost-boards";

function getConfigPath(): string {
  switch (process.platform) {
    case "win32":
      return path.join(process.env.APPDATA ?? os.homedir(), "Claude", "claude_desktop_config.json");
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
    default:
      return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
  }
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

export async function runSetup() {
  console.log();
  p.intro("  MCP Boards — Setup wizard  ");

  const configPath = getConfigPath();

  // 1. Detectar si Claude Desktop está corriendo
  if (isClaudeRunning()) {
    p.log.warn("Claude Desktop está corriendo. Cerralo antes de continuar para que tome los cambios.");
    const confirmed = await p.confirm({
      message: "¿Ya cerraste Claude Desktop?",
      initialValue: false,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Cerrá Claude Desktop y volvé a correr el wizard.");
      process.exit(0);
    }
  }

  // 2. Leer config existente
  let config: any;
  try {
    config = readConfig(configPath);
  } catch (err: any) {
    p.log.error(err.message);
    process.exit(1);
  }

  // 3. Verificar si ya existe la entrada
  if (config?.mcpServers?.[MCP_NAME]) {
    const overwrite = await p.confirm({
      message: `Ya existe una entrada "${MCP_NAME}". ¿Sobreescribirla?`,
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Instalación cancelada. La configuración existente no fue modificada.");
      process.exit(0);
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

  // 6. Merge y escribir
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers[MCP_NAME] = {
    command: "npx",
    args: ["-y", "mcp-boards-nk@latest"],
    env: {
      MATTERMOST_URL: (url as string).replace(/\/$/, ""),
      MATTERMOST_TOKEN: token as string,
    },
  };

  try {
    writeConfig(configPath, config);
  } catch (err: any) {
    p.log.error(`Error de permisos al escribir en: ${configPath}`);
    p.log.error(err.message);
    process.exit(1);
  }

  p.log.success(`Configuración escrita correctamente en:\n  ${configPath}`);
  p.outro("Abrí Claude Desktop nuevamente para activar el MCP.");
}

runSetup();
