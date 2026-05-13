/**
 * Theme store for the flyering app.
 * Three themes: dark (default), cambridge-dev, light.
 */

import { writable } from "svelte/store";

export type ThemeName = "dark" | "cambridge" | "light";

export const theme = writable<ThemeName>("dark");

export interface ThemeTokens {
  bg: string;
  bgPanel: string;
  bgCard: string;
  border: string;
  borderSubtle: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  markerBright: string;
  markerMid: string;
  markerDim: string;
  codeBg: string;
  codeText: string;
  codeKw: string;
  codeOp: string;
  codeSym: string;
  codeFn: string;
  codeLineNum: string;
  mapTile: string;
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  dark: {
    bg: "#0a0a0a",
    bgPanel: "#0a0a0a",
    bgCard: "#0f0f0f",
    border: "#1a1a1a",
    borderSubtle: "#111",
    text: "#e8e8e8",
    textMuted: "#888",
    textDim: "#555",
    accent: "#e8e8e8",
    markerBright: "#e8e8e8",
    markerMid: "#888888",
    markerDim: "#444444",
    codeBg: "#0a0a0a",
    codeText: "#888",
    codeKw: "#bbb",
    codeOp: "#666",
    codeSym: "#777",
    codeFn: "#ccc",
    codeLineNum: "#333",
    mapTile: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  },
  cambridge: {
    bg: "#fafafa",
    bgPanel: "#ffffff",
    bgCard: "#f5f5f0",
    border: "#e0e0d8",
    borderSubtle: "#eee",
    text: "#1a1a1a",
    textMuted: "#555",
    textDim: "#888",
    accent: "#2a5a3a",
    markerBright: "#2a5a3a",
    markerMid: "#6b8f7b",
    markerDim: "#b8ccbf",
    codeBg: "#f0f0ea",
    codeText: "#445",
    codeKw: "#2a5a3a",
    codeOp: "#888",
    codeSym: "#666",
    codeFn: "#1a1a1a",
    codeLineNum: "#bbb",
    mapTile: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  },
  light: {
    bg: "#ffffff",
    bgPanel: "#ffffff",
    bgCard: "#f8f8f8",
    border: "#e5e5e5",
    borderSubtle: "#f0f0f0",
    text: "#1a1a1a",
    textMuted: "#666",
    textDim: "#999",
    accent: "#1a1a1a",
    markerBright: "#1a1a1a",
    markerMid: "#888888",
    markerDim: "#cccccc",
    codeBg: "#f5f5f5",
    codeText: "#555",
    codeKw: "#1a1a1a",
    codeOp: "#999",
    codeSym: "#777",
    codeFn: "#333",
    codeLineNum: "#ccc",
    mapTile: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  },
};
