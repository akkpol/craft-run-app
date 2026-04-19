import * as THREE from "three";

type RendererMode = "webgpu" | "webgl";

type RendererLike = {
  domElement: HTMLCanvasElement;
  setPixelRatio: (value: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  setAnimationLoop: (callback: FrameRequestCallback | null) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
  dispose: () => void;
  toneMapping?: number;
  outputColorSpace?: THREE.ColorSpace;
};

export type FactoryRendererHandle = {
  mode: RendererMode;
  renderer: RendererLike;
  dispose: () => void;
};

export async function createFactoryRenderer(
  canvas: HTMLCanvasElement
): Promise<FactoryRendererHandle> {
  const baseOptions = {
    canvas,
    antialias: true,
    alpha: true,
  };

  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const webgpu = await import("three/webgpu");
      const renderer = new webgpu.WebGPURenderer(baseOptions) as unknown as RendererLike & {
        init?: () => Promise<void>;
      };

      if (renderer.init) {
        await renderer.init();
      }

      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      return {
        mode: "webgpu",
        renderer,
        dispose: () => renderer.dispose(),
      };
    } catch {
      // WebGPU stays an optional fast path. Falling back to WebGL is intentional.
    }
  }

  const renderer = new THREE.WebGLRenderer(baseOptions) as RendererLike;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  return {
    mode: "webgl",
    renderer,
    dispose: () => renderer.dispose(),
  };
}
