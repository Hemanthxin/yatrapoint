"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, ShieldCheck, Wallet, Compass, Plane, Mountain, Navigation } from "lucide-react";
import { AnimatedWords } from "@/components/app/AnimatedWords";
import { ParallaxLayer } from "@/components/ParallaxStage";

export function Hero() {
  return (
    <div className="relative z-10 flex max-w-xl flex-col gap-8 text-white" style={{ perspective: 1000 }}>
      {/* Floating decorative chips at their own parallax depth — scattered
          "3D space" around the headline instead of everything sitting flat
          on one plane. */}
      <ParallaxLayer depth={55} rotate={10} className="pointer-events-none absolute -left-6 top-2 hidden lg:block">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10 text-sky-200 shadow-lg backdrop-blur-md"
        >
          <Plane className="h-5 w-5 -rotate-45" />
        </motion.div>
      </ParallaxLayer>
      <ParallaxLayer depth={-45} rotate={-8} className="pointer-events-none absolute right-10 top-20 hidden lg:block">
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/10 text-blue-200 shadow-lg backdrop-blur-md"
        >
          <Mountain className="h-5 w-5" />
        </motion.div>
      </ParallaxLayer>
      <ParallaxLayer depth={35} rotate={14} className="pointer-events-none absolute left-16 bottom-0 hidden lg:block">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="grid h-10 w-10 place-items-center rounded-2xl border border-white/20 bg-white/10 text-amber-200 shadow-lg backdrop-blur-md"
        >
          <Navigation className="h-4 w-4" />
        </motion.div>
      </ParallaxLayer>

      <div>
        <motion.span
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md"
        >
          <Compass className="h-3.5 w-3.5 text-amber-300" />
          Your journey starts here
        </motion.span>
        {/* The mark itself tilts in real 3D toward the cursor — depth=18
            alone would just translate it; `rotate` turns the same pointer
            position into rotateX/rotateY instead, so it reads as a solid
            object catching the light, not a sticker sliding around. */}
        <ParallaxLayer depth={0} rotate={14} style={{ transformStyle: "preserve-3d" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/saafera-logo.jpg"
              alt="Saafera"
              width={280}
              height={280}
              priority
              className="app-logo h-auto w-40 md:w-48"
            />
          </motion.div>
        </ParallaxLayer>
        <h1 className="sr-only">Saafera</h1>
        <p className="mt-3 text-2xl font-semibold text-white drop-shadow-lg">
          <AnimatedWords text="Explore More. Fulfill Soul." delay={0.35} stagger={0.07} />
        </p>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 max-w-md text-sm text-white/80"
        >
          From ancient temples to majestic waterfalls, find the perfect trip
          within your budget.
        </motion.p>
      </div>

      <div className="grid max-w-md grid-cols-3 gap-6">
        <Feature
          icon={<MapPin className="h-5 w-5" />}
          title="Explore More"
          subtitle={["Hidden gems &", "top destinations"]}
          delay={0.8}
        />
        <Feature
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Safe & Secure"
          subtitle={["Your safety is", "our priority"]}
          delay={0.9}
        />
        <Feature
          icon={<Wallet className="h-5 w-5" />}
          title="Budget Friendly"
          subtitle={["Best plans that", "fit your budget"]}
          delay={1.0}
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.15 }}
        className="font-script text-2xl text-brand-green"
      >
        Your Journey, Our Passion
      </motion.p>
    </div>
  );
}

function Feature({
  icon,
  title,
  subtitle,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string[];
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ y: -3 }}
      className="flex flex-col items-start gap-2 text-sm"
    >
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/10 text-brand-green shadow-lg shadow-blue-500/10 backdrop-blur-md transition hover:scale-105 hover:border-blue-400/40">
        {icon}
      </div>
      <p className="font-semibold text-white">{title}</p>
      <p className="text-xs leading-tight text-white/70">
        {subtitle[0]}
        <br />
        {subtitle[1]}
      </p>
    </motion.div>
  );
}
