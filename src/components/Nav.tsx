"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface NavProps {
  actionLabel?: string;
  actionHref?: string;
}

// No brand mark here — the Hero already carries the logo on this screen, and
// repeating it in the corner too was visual clutter. Just the admin link.
export function Nav({
  actionLabel = "Admin",
  actionHref = "/admin-login",
}: NavProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-x-0 top-0 z-20 flex items-center justify-end px-5 py-5 md:px-6"
    >
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
        <Link
          href={actionHref}
          className="rounded-full border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/25"
        >
          {actionLabel}
        </Link>
      </motion.div>
    </motion.header>
  );
}
