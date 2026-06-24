#!/usr/bin/env node
import * as p from "@clack/prompts";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const MCP_NAME = "mattermost-boards";
const UNINSTALL = process.argv.includes("--uninstall") || process.argv.includes("--remove");

function getClaudeDesktopConfigPath(): string {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    const packagesDir = path.join(localAppData, "Packages");
    if (fs.existsSync(packagesDir)) {
      const entries = fs.readdirSync(packagesDir);
      const claudePackage = entries.find((e) => e.startsWith("Claude_") || e.startsWith("AnthropicPBC.Claude_"));
      if (claudePackage) {
        const storePath = path.join(packagesDir, claudePackage, "LocalCache", "Roaming", "Claude", "claude_desktop_config.json");
        return storePath;
      }
    }
    return path.join(process.env.APPDATA ?? os.homedir(), "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
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

function uninstallFromJsonConfig(configPath: string): boolean {
  const config = readConfig(configPath);
  if (!config?.mcpServers?.[MCP_NAME]) return false;
  delete config.mcpServers[MCP_NAME];
  if (Object.keys(config.mcpServers).length === 0) delete config.mcpServers;
  writeConfig(configPath, config);
  return true;
}

async function runUninstall() {
  console.log();
  p.intro("  MCP Boards — Desinstalador  ");

  const clients = await p.multiselect({
    message: "¿De qué clientes querés desinstalar el MCP?",
    options: [
      { value: "claude-desktop", label: "Claude Desktop" },
      { value: "claude-code-user", label: "Claude Code — Global (user)" },
      { value: "claude-code-project", label: "Claude Code — Proyecto" },
    ],
    required: true,
  });
  if (p.isCancel(clients)) { p.cancel("Cancelado."); process.exit(0); }

  const selected = clients as string[];
  const spinner = p.spinner();
  spinner.start("Desinstalando...");

  for (const client of selected) {
    try {
      if (client === "claude-desktop") {
        const configPath = getClaudeDesktopConfigPath();
        const removed = uninstallFromJsonConfig(configPath);
        p.log.info(`Claude Desktop: ${removed ? "✓ removido" : "no encontrado"}`);
      } else if (client === "claude-code-user") {
        try {
          execSync(`claude mcp remove ${MCP_NAME} -s user`, { stdio: "pipe" });
          p.log.info("Claude Code (user): ✓ removido");
        } catch {
          p.log.info("Claude Code (user): no encontrado");
        }
      } else if (client === "claude-code-project") {
        try {
          execSync(`claude mcp remove ${MCP_NAME} -s project`, { stdio: "pipe" });
          p.log.info("Claude Code (project): ✓ removido");
        } catch {
          p.log.info("Claude Code (project): no encontrado");
        }
      }
    } catch (err: any) {
      p.log.error(`Error en ${client}: ${err.message}`);
    }
  }

  spinner.stop("Desinstalación completada.");
  p.outro("Reiniciá los clientes para que tomen los cambios.");
}

async function runInstall() {
  console.log();
  p.intro("  MCP Boards — Setup wizard  ");

  // 1. Multiselect de clientes
  const clients = await p.multiselect({
    message: "¿En qué clientes querés instalar el MCP?",
    options: [
      { value: "claude-desktop", label: "Claude Desktop" },
      { value: "claude-code-user", label: "Claude Code — Global (user)" },
      { value: "claude-code-project", label: "Claude Code — Proyecto" },
    ],
    required: true,
  });
  if (p.isCancel(clients)) { p.cancel("Instalación cancelada."); process.exit(0); }

  const selected = clients as string[];

  // 2. Si Claude Desktop está entre los seleccionados, verificar que esté cerrado
  if (selected.includes("claude-desktop") && isClaudeRunning()) {
    p.log.warn("Claude Desktop está corriendo. Cerralo antes de continuar.");
    const confirmed = await p.confirm({ message: "¿Ya cerraste Claude Desktop?", initialValue: false });
    if (p.isCancel(confirmed) || !confirmed) { p.cancel("Cerrá Claude Desktop y volvé a correr el wizard."); process.exit(0); }
  }

  // 3. Verificar entradas existentes en Desktop
  if (selected.includes("claude-desktop")) {
    const configPath = getClaudeDesktopConfigPath();
    const existing = readConfig(configPath);
    if (existing?.mcpServers?.[MCP_NAME]) {
      const overwrite = await p.confirm({
        message: `Ya existe "${MCP_NAME}" en Claude Desktop. ¿Sobreescribirla?`,
        initialValue: false,
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel("Instalación cancelada."); process.exit(0);
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
    validate: (v) => { if (!v || v.length < 10) return "Token inválido o demasiado corto"; },
  });
  if (p.isCancel(token)) { p.cancel("Instalación cancelada."); process.exit(0); }

  const cleanUrl = (url as string).replace(/\/$/, "");
  const cleanToken = token as string;

  const spinner = p.spinner();
  spinner.start("Instalando...");

  for (const client of selected) {
    try {
      if (client === "claude-desktop") {
        const configPath = getClaudeDesktopConfigPath();
        const config = readConfig(configPath);
        config.mcpServers = config.mcpServers ?? {};
        config.mcpServers[MCP_NAME] = {
          command: "npx",
          args: ["-y", "mcp-boards-nk@latest"],
          env: { MATTERMOST_URL: cleanUrl, MATTERMOST_TOKEN: cleanToken },
        };
        writeConfig(configPath, config);
        p.log.info(`Claude Desktop: ✓ ${configPath}`);

      } else if (client === "claude-code-user" || client === "claude-code-project") {
        const scope = client === "claude-code-user" ? "user" : "project";
        const cmd = `claude mcp add -s ${scope} ${MCP_NAME} -e MATTERMOST_URL=${cleanUrl} -e MATTERMOST_TOKEN=${cleanToken} -- npx -y mcp-boards-nk@latest`;
        execSync(cmd, { stdio: "inherit" });
        p.log.info(`Claude Code (${scope}): ✓ instalado`);
      }
    } catch (err: any) {
      p.log.error(`Error en ${client}: ${err.message ?? String(err)}`);
    }
  }

  spinner.stop("Instalación completada.");
  p.outro("Reiniciá los clientes seleccionados para activar el MCP.");
}

export async function runSetup() {
  if (UNINSTALL) {
    await runUninstall();
  } else {
    await runInstall();
  }
}

runSetup();
