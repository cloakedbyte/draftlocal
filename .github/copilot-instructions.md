# Copilot Instructions

This file provides guidance for GitHub Copilot when working in this repository.

## VS Code Agent Configuration

The table below explains the key fields used when configuring a VS Code Copilot agent persona:

| Line | What it means | Why it matters |
| --- | --- | --- |
| `description:` | A label so VS Code knows what this file does | Copilot reads this to understand the agent's role |
| `applyTo: '**'` | Apply this persona to **every file** (`**` = wildcard = all files) | Without this, the reviewer only works on specific files |
