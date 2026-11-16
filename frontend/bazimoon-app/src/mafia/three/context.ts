import { createContext, useContext } from "react";
import type { TableWorld } from "./world";

/**
 * The 3D table for the game in progress, made once by the Mafia stage. Null while it loads, and for
 * good on a device without WebGL (or after the GPU drops it): screens then show the flat table.
 */
export const TableWorldContext = createContext<TableWorld | null>(null);

let webgl: boolean | undefined;

/** True when this device can draw the 3D table at all. Cheap, asked once, and needs no 3D code loaded. */
export function canUseWebGL() {
  if (webgl === undefined) {
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
      webgl = Boolean(gl);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

export function useTableWorld() {
  return useContext(TableWorldContext);
}
