import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildGithubRepoName,
  buildPublishFiles,
  runHtmlProductionChecks,
  runLiveProductionChecks,
  type DraftSiteBrief,
  type ProductionCheck,
} from "@ct/core";
import type { SiteDraft } from "@ct/db";

export interface PublishResult {
  draft: Partial<SiteDraft>;
}

export async function publishGeneratedSite(input: {
  leadId: string;
  businessName: string;
  municipality: string;
  html: string;
  brief: DraftSiteBrief;
  workDir: string;
}): Promise<PublishResult> {
  const githubToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const vercelToken = process.env.VERCEL_TOKEN;
  const owner = process.env.SITE_GITHUB_OWNER ?? process.env.GITHUB_OWNER;
  const teamId = process.env.VERCEL_TEAM_ID;
  const autoPublish = process.env.AUTO_PUBLISH_SITES !== "false";

  const localChecks = runHtmlProductionChecks(input.html, input.businessName);
  if (!localChecks.passed) {
    return {
      draft: {
        status: "failed",
        publishStatus: "failed",
        testsPassed: false,
        testChecks: localChecks.checks,
        error: "Local production checks failed before publish",
      },
    };
  }

  if (!autoPublish) {
    return {
      draft: {
        status: "ready",
        publishStatus: "skipped",
        testsPassed: true,
        testChecks: localChecks.checks,
        error: null,
      },
    };
  }

  if (!githubToken || !vercelToken || !owner) {
    return {
      draft: {
        status: "ready",
        publishStatus: "skipped",
        testsPassed: true,
        testChecks: [
          ...localChecks.checks,
          {
            name: "Publish credentials",
            ok: false,
            detail: "Set GITHUB_TOKEN, VERCEL_TOKEN, and SITE_GITHUB_OWNER to auto-create a repo and deploy to Vercel",
          },
        ],
        error: "Draft ready locally. Add GitHub and Vercel tokens to publish.",
      },
    };
  }

  const repoName = buildGithubRepoName(input.businessName, input.leadId);
  const files = buildPublishFiles({
    html: input.html,
    brief: input.brief,
    businessName: input.businessName,
    municipality: input.municipality,
  });
  mkdirSync(input.workDir, { recursive: true });
  for (const file of files) {
    const full = path.join(input.workDir, file.path);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, file.content, "utf8");
  }

  const repo = await createGithubRepo({ token: githubToken, owner, name: repoName, description: `Generated site for ${input.businessName}` });
  pushDirectoryToGithub({
    workDir: input.workDir,
    token: githubToken,
    owner,
    repo: repoName,
  });

  const deployment = await deployToVercel({
    token: vercelToken,
    teamId,
    name: repoName,
    files,
  });

  const liveChecks = await runLiveProductionChecks(deployment.url, input.businessName);
  const checks: ProductionCheck[] = [...localChecks.checks, ...liveChecks.checks];
  const passed = localChecks.passed && liveChecks.passed;

  return {
    draft: {
      status: passed ? "ready" : "failed",
      publishStatus: passed ? "published" : "failed",
      repoUrl: repo.htmlUrl,
      githubRepo: `${owner}/${repoName}`,
      deploymentUrl: deployment.url,
      vercelProjectId: deployment.projectId,
      testsPassed: passed,
      testChecks: checks,
      error: passed ? null : "Published, but one or more production checks failed",
      summary: passed
        ? `Published to Vercel after passing production checks.`
        : `Deployed, but production checks failed. Review ${deployment.url}`,
    },
  };
}

async function createGithubRepo(input: {
  token: string;
  owner: string;
  name: string;
  description: string;
}): Promise<{ htmlUrl: string }> {
  const existing = await fetch(`https://api.github.com/repos/${input.owner}/${input.name}`, {
    headers: githubHeaders(input.token),
  });
  if (existing.ok) {
    const body = (await existing.json()) as { html_url: string };
    return { htmlUrl: body.html_url };
  }
  const user = await fetch("https://api.github.com/user", { headers: githubHeaders(input.token) });
  if (!user.ok) throw new Error(`GitHub auth failed: ${user.status}`);
  const me = (await user.json()) as { login: string };
  const endpoint =
    me.login.toLowerCase() === input.owner.toLowerCase()
      ? "https://api.github.com/user/repos"
      : `https://api.github.com/orgs/${input.owner}/repos`;
  const created = await fetch(endpoint, {
    method: "POST",
    headers: { ...githubHeaders(input.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      private: true,
      auto_init: false,
      has_issues: false,
      has_projects: false,
      has_wiki: false,
    }),
  });
  if (!created.ok) {
    const text = await created.text();
    throw new Error(`GitHub create repo failed: ${created.status} ${text}`);
  }
  const body = (await created.json()) as { html_url: string };
  return { htmlUrl: body.html_url };
}

function pushDirectoryToGithub(input: { workDir: string; token: string; owner: string; repo: string }): void {
  const remote = `https://x-access-token:${input.token}@github.com/${input.owner}/${input.repo}.git`;
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  execFileSync("git", ["init", "-b", "main"], { cwd: input.workDir, env });
  execFileSync("git", ["config", "user.email", "ct-lead-agent@users.noreply.github.com"], { cwd: input.workDir, env });
  execFileSync("git", ["config", "user.name", "CT Web Lead Agent"], { cwd: input.workDir, env });
  execFileSync("git", ["add", "."], { cwd: input.workDir, env });
  execFileSync("git", ["commit", "-m", "Initial generated site from audit"], { cwd: input.workDir, env });
  execFileSync("git", ["remote", "add", "origin", remote], { cwd: input.workDir, env });
  execFileSync("git", ["push", "-u", "origin", "main"], { cwd: input.workDir, env });
}

async function deployToVercel(input: {
  token: string;
  teamId?: string;
  name: string;
  files: Array<{ path: string; content: string }>;
}): Promise<{ url: string; projectId: string | null; deploymentId: string }> {
  const endpoint = new URL("https://api.vercel.com/v13/deployments");
  if (input.teamId) endpoint.searchParams.set("teamId", input.teamId);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      project: input.name,
      target: "production",
      projectSettings: {
        framework: null,
        ssoProtection: null,
      },
      files: input.files.map((file) => ({
        file: file.path,
        data: file.content,
        encoding: "utf-8",
      })),
    }),
  });
  if (!response.ok) {
    throw new Error(`Vercel deploy failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as {
    id: string;
    url?: string;
    projectId?: string;
    readyState?: string;
  };
  const ready = await waitForVercelDeployment(input.token, body.id, input.teamId);
  const host = ready.url ?? body.url;
  if (!host) throw new Error("Vercel deployment did not return a URL");
  const projectId = ready.projectId ?? body.projectId ?? null;
  if (projectId) {
    await disableVercelDeploymentProtection(input.token, projectId, input.teamId);
  }
  const deploymentUrl = host.startsWith("http") ? host : `https://${host}`;
  // Prefer the stable production alias for operator-facing URLs and live checks.
  const productionUrl = `https://${input.name}.vercel.app`;
  const probe = await fetch(productionUrl, { redirect: "follow", signal: AbortSignal.timeout(15_000) }).catch(() => null);
  return {
    url: probe?.ok ? productionUrl : deploymentUrl,
    projectId,
    deploymentId: body.id,
  };
}

async function disableVercelDeploymentProtection(
  token: string,
  projectId: string,
  teamId?: string,
): Promise<void> {
  const endpoint = new URL(`https://api.vercel.com/v9/projects/${projectId}`);
  if (teamId) endpoint.searchParams.set("teamId", teamId);
  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ssoProtection: null }),
  });
  if (!response.ok) {
    // Non-fatal: live checks may still pass via shareable URL or if protection was already off.
    console.warn(`Could not disable Vercel auth for ${projectId}: ${response.status}`);
  }
}

async function waitForVercelDeployment(
  token: string,
  deploymentId: string,
  teamId?: string,
): Promise<{ url?: string; projectId?: string; readyState?: string }> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const endpoint = new URL(`https://api.vercel.com/v13/deployments/${deploymentId}`);
    if (teamId) endpoint.searchParams.set("teamId", teamId);
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Vercel status failed: ${response.status}`);
    const body = (await response.json()) as { readyState?: string; url?: string; projectId?: string };
    if (body.readyState === "READY") return body;
    if (body.readyState === "ERROR" || body.readyState === "CANCELED") {
      throw new Error(`Vercel deployment ${body.readyState}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Timed out waiting for Vercel deployment");
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ct-web-lead-agent",
  };
}
