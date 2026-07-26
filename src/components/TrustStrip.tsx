"use client";

import { motion } from "framer-motion";
import { Lock, Headset, Star } from "lucide-react";

const items = [
  {
    icon: <Lock className="h-5 w-5" />,
    title: "Secure & Private",
    body: "We never share your number with anyone.",
  },
  {
    icon: <Headset className="h-5 w-5" />,
    title: "Need Help?",
    body: "Our support team is always here for you.",
  },
  {
    icon: <Star className="h-5 w-5" />,
    title: "Trusted by Travellers",
    body: "Join thousands of happy travellers exploring the world.",
  },
];

export function TrustStrip() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      transition={{ staggerChildren: 0.12 }}
      className="relative z-10 mt-12 grid w-full grid-cols-1 gap-6 rounded-3xl border border-white/15 bg-black/35 px-6 py-6 backdrop-blur-xl md:grid-cols-3 md:gap-10 md:px-10"
    >
      {items.map((i) => (
        <motion.div
          key={i.title}
          variants={{
            hidden: { opacity: 0, scale: 0.85, y: 16 },
            visible: { opacity: 1, scale: 1, y: 0 },
          }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -3 }}
          className="flex items-start gap-3"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-brand-green shadow-inner">
            {i.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{i.title}</p>
            <p className="text-xs text-white/70">{i.body}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
