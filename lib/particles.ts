// 가벼운 캔버스 2D 파티클 엔진 — 외부 의존성 없이 직접 구현.
// 배틀 배경(비/불씨)과 포획 연출(스파크/별/충격파)에서 공용으로 사용한다.

export type BurstKind = "spark" | "star" | "shockwave";
export type AmbientKind = "rain" | "ember";
type ParticleKind = BurstKind | AmbientKind;

interface Particle {
  kind: ParticleKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string; // "r,g,b" 형식
  rotation: number; rotSpeed: number;
  gravity: number;
  wobbleAmp: number; wobbleSpeed: number; wobblePhase: number;
}

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const a2 = a1 + Math.PI / 5;
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    ctx.lineTo(Math.cos(a2) * (r * 0.42), Math.sin(a2) * (r * 0.42));
  }
  ctx.closePath();
  ctx.fill();
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private ambientKind: AmbientKind | null = null;
  private ambientColor = "255,255,255";
  private ambientIntensity = 1;
  private spawnAccum = 0;

  setAmbient(kind: AmbientKind | null, color?: string, intensity = 1) {
    this.ambientKind = kind;
    if (color) this.ambientColor = color;
    this.ambientIntensity = intensity;
    if (!kind) this.particles = this.particles.filter(p => p.kind !== "rain" && p.kind !== "ember");
  }

  burst(x: number, y: number, kind: BurstKind, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      if (kind === "shockwave") {
        this.particles.push({
          kind, x, y, vx: 0, vy: 0, life: 0, maxLife: 0.5, size: 8, color,
          rotation: 0, rotSpeed: 0, gravity: 0, wobbleAmp: 0, wobbleSpeed: 0, wobblePhase: 0,
        });
        continue;
      }
      const angle = Math.random() * Math.PI * 2;
      const isStar = kind === "star";
      const speed = isStar ? 60 + Math.random() * 120 : 90 + Math.random() * 200;
      this.particles.push({
        kind, x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isStar ? 70 : 0),
        life: 0,
        maxLife: isStar ? 0.65 + Math.random() * 0.45 : 0.32 + Math.random() * 0.22,
        size: isStar ? 4 + Math.random() * 5 : 1.6 + Math.random() * 2.6,
        color,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 9,
        gravity: isStar ? 260 : 40,
        wobbleAmp: 0, wobbleSpeed: 0, wobblePhase: 0,
      });
    }
  }

  update(dt: number, w: number, h: number) {
    if (this.ambientKind === "rain") {
      this.spawnAccum += dt * 46 * this.ambientIntensity;
      while (this.spawnAccum > 1) {
        this.spawnAccum--;
        this.particles.push({
          kind: "rain", x: Math.random() * w * 1.3 - w * 0.15, y: -10,
          vx: -70, vy: 640 + Math.random() * 220,
          life: 0, maxLife: 2.5, size: 1 + Math.random() * 0.8,
          color: this.ambientColor, rotation: 0, rotSpeed: 0, gravity: 0,
          wobbleAmp: 0, wobbleSpeed: 0, wobblePhase: 0,
        });
      }
    } else if (this.ambientKind === "ember") {
      this.spawnAccum += dt * 5.5 * this.ambientIntensity;
      while (this.spawnAccum > 1) {
        this.spawnAccum--;
        this.particles.push({
          kind: "ember", x: Math.random() * w, y: h + 10,
          vx: 0, vy: -(28 + Math.random() * 38),
          life: 0, maxLife: 3.2 + Math.random() * 2, size: 1.4 + Math.random() * 2,
          color: this.ambientColor, rotation: 0, rotSpeed: 0, gravity: 0,
          wobbleAmp: 10 + Math.random() * 12, wobbleSpeed: 1 + Math.random() * 1.3,
          wobblePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    for (const p of this.particles) {
      p.life += dt;
      if (p.kind === "rain") {
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.kind === "ember") {
        p.wobblePhase += p.wobbleSpeed * dt;
        p.x += Math.sin(p.wobblePhase) * p.wobbleAmp * dt;
        p.y += p.vy * dt;
      } else if (p.kind !== "shockwave") {
        p.vy += p.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;
      }
    }

    this.particles = this.particles.filter(p => {
      if (p.kind === "rain") return p.y < h + 20 && p.life < p.maxLife;
      if (p.kind === "ember") return p.y > -20 && p.life < p.maxLife;
      return p.life < p.maxLife;
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      if (p.kind === "rain") {
        const alpha = 0.5 * (1 - t * 0.3);
        ctx.strokeStyle = `rgba(${p.color},${alpha})`;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.02, p.y + 14);
        ctx.stroke();
      } else if (p.kind === "ember") {
        const alpha = Math.max(0, Math.sin(Math.min(1, t * 3)) * (1 - t));
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "shockwave") {
        const radius = 10 + t * 70;
        ctx.strokeStyle = `rgba(${p.color},${1 - t})`;
        ctx.lineWidth = Math.max(1, 6 * (1 - t));
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "spark") {
        ctx.fillStyle = `rgba(${p.color},${1 - t})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "star") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = `rgba(${p.color},${1 - t})`;
        drawStar(ctx, p.size);
        ctx.restore();
      }
    }
  }

  get count() { return this.particles.length; }
}
