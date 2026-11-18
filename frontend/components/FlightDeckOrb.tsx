"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface FlightDeckOrbProps {
  mode?: "WORK" | "STUDY" | "RELAX";
  audioEnergy?: number; // 0.0 to 1.0 from visualizer
  isPhaseShifting?: boolean;
  isBreathing?: boolean;
  onTelemetryUpdate?: (telemetry: { fps: number; dpr: number }) => void;
}

// Color palettes per mode (Core and Rim in RGB)
const PALETTES = {
  WORK: {
    core: new THREE.Color("#090d16"), // Deep Indigo
    rim: new THREE.Color("#00f5ff"),  // Electric Cyan
    secondary: new THREE.Color("#8b5cf6") // Violet
  },
  STUDY: {
    core: new THREE.Color("#051c14"), // Dark Forest
    rim: new THREE.Color("#10b981"),  // Emerald
    secondary: new THREE.Color("#34d399") // Mint
  },
  RELAX: {
    core: new THREE.Color("#1a0b1c"), // Dark Plum
    rim: new THREE.Color("#f59e0b"),  // Golden Amber
    secondary: new THREE.Color("#f43f5e") // Sunset Rose
  }
};

// GLSL Simplex 3D Noise Implementation
const NOISE_GLSL = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

const VERTEX_SHADER = `
${NOISE_GLSL}

uniform float u_time;
uniform float u_speed;
uniform float u_noiseFreq;
uniform float u_displacementAmp;
uniform float u_audioEnergy;
uniform float u_shockwave;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisplacement;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vViewDir = normalize(cameraPosition - worldPos.xyz);

  // Simplex 3D organic breathing
  float noise = snoise(position * u_noiseFreq + vec3(0.0, u_time * u_speed, u_time * 0.2));
  
  // Audio reactivity & shockwave expansion
  float dynamicAmp = u_displacementAmp + (u_audioEnergy * 0.35) + (u_shockwave * 0.8);
  vec3 newPosition = position + normal * (noise * dynamicAmp);

  vDisplacement = noise;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform vec3 u_colorCore;
uniform vec3 u_colorRim;
uniform vec3 u_colorSecondary;
uniform float u_shockwave;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisplacement;

void main() {
  // Fresnel calculation
  float fresnel = dot(vNormal, vViewDir);
  fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
  float rimIntensity = pow(fresnel, 2.5);

  // Color blending between deep translucent core and intense neon rim
  vec3 baseColor = mix(u_colorCore, u_colorSecondary, clamp(vDisplacement * 0.5 + 0.5, 0.0, 1.0));
  vec3 finalColor = mix(baseColor, u_colorRim, rimIntensity);

  // Shockwave flash
  finalColor += u_colorRim * u_shockwave * 0.6;

  float alpha = 0.85 + rimIntensity * 0.15;
  gl_FragColor = vec4(finalColor, alpha);
}
`;

export default function FlightDeckOrb({
  mode = "WORK",
  audioEnergy = 0.0,
  isPhaseShifting = false,
  isBreathing = false,
  onTelemetryUpdate
}: FlightDeckOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef<any>(null);
  const breathingRef = useRef<boolean>(isBreathing);
  const telemetryCallbackRef = useRef(onTelemetryUpdate);

  useEffect(() => {
    telemetryCallbackRef.current = onTelemetryUpdate;
  }, [onTelemetryUpdate]);

  // Cursor interpolation state
  const mouseState = useRef({
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    lastX: 0,
    lastY: 0,
    speed: 0
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 7.5;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Initial telemetry announcement
    telemetryCallbackRef.current?.({ fps: 60, dpr });

    // Detect accessibility preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 2. High-subdivision Icosahedron Geometry & Shader Material
    const geometry = new THREE.IcosahedronGeometry(2.2, 48);

    const initialPalette = PALETTES[mode] || PALETTES.WORK;
    const uniforms = {
      u_time: { value: 0 },
      u_speed: { value: prefersReducedMotion ? 0.05 : 0.55 },
      u_noiseFreq: { value: 0.75 },
      u_displacementAmp: { value: 0.28 },
      u_audioEnergy: { value: 0.0 },
      u_shockwave: { value: 0.0 },
      u_colorCore: { value: initialPalette.core.clone() },
      u_colorRim: { value: initialPalette.rim.clone() },
      u_colorSecondary: { value: initialPalette.secondary.clone() }
    };
    uniformsRef.current = uniforms;

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: uniforms,
      transparent: true,
      blending: THREE.NormalBlending
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 3. Mouse Movement Listener (Normalized [-1, 1])
    const handleMouseMove = (e: MouseEvent) => {
      if (prefersReducedMotion) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      const dx = x - mouseState.current.lastX;
      const dy = y - mouseState.current.lastY;
      mouseState.current.speed = Math.sqrt(dx * dx + dy * dy);
      mouseState.current.lastX = x;
      mouseState.current.lastY = y;

      mouseState.current.targetX = x;
      mouseState.current.targetY = y;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 4. Resize Listener
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // 5. Render Loop with Complete Visibility-Pause Optimization & Real FPS Telemetry
    let animationFrameId: number;
    let isLoopRunning = false;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    const clock = new THREE.Clock();

    const animate = () => {
      if (document.hidden) {
        isLoopRunning = false;
        return;
      }
      isLoopRunning = true;

      // Rolling FPS calculation
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        const measuredFps = Math.min(120, Math.round((frameCount * 1000) / (now - lastFpsTime)));
        telemetryCallbackRef.current?.({ fps: measuredFps, dpr });
        frameCount = 0;
        lastFpsTime = now;
      }

      const elapsedTime = clock.getElapsedTime();
      uniforms.u_time.value = elapsedTime;

      if (!prefersReducedMotion) {
        // Smooth mouse lerp for magnetic tilt
        const m = mouseState.current;
        m.currentX += (m.targetX - m.currentX) * 0.05;
        m.currentY += (m.targetY - m.currentY) * 0.05;

        mesh.rotation.y = m.currentX * 0.4 + elapsedTime * 0.12;
        mesh.rotation.x = -m.currentY * 0.4;

        // Mouse speed adds to displacement amplitude, then decays
        const speedBoost = Math.min(m.speed * 0.8, 0.4);
        let baseAmp = 0.28;
        if (breathingRef.current) {
          const breath = Math.sin(elapsedTime * (Math.PI / 2.0)) * 0.12;
          baseAmp = 0.32 + breath;
        }
        uniforms.u_displacementAmp.value = baseAmp + speedBoost;
        m.speed *= 0.92;
      } else {
        mesh.rotation.y = 0;
        mesh.rotation.x = 0;
        uniforms.u_displacementAmp.value = 0.22;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (isLoopRunning) {
          cancelAnimationFrame(animationFrameId);
          isLoopRunning = false;
        }
      } else {
        if (!isLoopRunning) {
          lastFpsTime = performance.now();
          frameCount = 0;
          animationFrameId = requestAnimationFrame(animate);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Initial frame start
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  // Update uniforms when mode or audio props change
  useEffect(() => {
    if (!uniformsRef.current) return;
    const uniforms = uniformsRef.current;
    const palette = PALETTES[mode] || PALETTES.WORK;

    // Smooth color lerp
    uniforms.u_colorCore.value.lerp(palette.core, 0.15);
    uniforms.u_colorRim.value.lerp(palette.rim, 0.15);
    uniforms.u_colorSecondary.value.lerp(palette.secondary, 0.15);
  }, [mode]);

  useEffect(() => {
    if (!uniformsRef.current) return;
    uniformsRef.current.u_audioEnergy.value = audioEnergy;
  }, [audioEnergy]);

  useEffect(() => {
    if (!uniformsRef.current) return;
    if (isPhaseShifting) {
      uniformsRef.current.u_shockwave.value = 1.0;
      const decay = setInterval(() => {
        if (!uniformsRef.current) {
          clearInterval(decay);
          return;
        }
        uniformsRef.current.u_shockwave.value *= 0.88;
        if (uniformsRef.current.u_shockwave.value < 0.02) {
          uniformsRef.current.u_shockwave.value = 0.0;
          clearInterval(decay);
        }
      }, 30);
    }
  }, [isPhaseShifting]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden pointer-events-none"
      style={{ minHeight: "420px" }}
    />
  );
}
