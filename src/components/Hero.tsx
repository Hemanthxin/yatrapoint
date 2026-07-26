"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, ShieldCheck, Wallet, Compass } from "lucide-react";
import { AnimatedWords } from "@/components/app/AnimatedWords";

export function Hero() {
  return (
    <div className="relative z-10 flex max-w-xl flex-col gap-8 text-white">
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
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/10 text-brand-green shadow-lg shadow-emerald-500/10 backdrop-blur-md transition hover:scale-105 hover:border-emerald-400/40">
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
