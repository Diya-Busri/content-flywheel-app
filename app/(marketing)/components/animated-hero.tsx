"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AnimatedHero() {
  return (
    <motion.div 
      className="text-center space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-2">
        <span>Turn your knowledge into passive income</span>
      </div>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
        Package & Market <span className="text-primary">Digital Products</span> in Minutes
      </h1>
      <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
        From eBook to promo video in one workflow. AI writes the copy, generates the mockup, and creates your avatar video — ready to sell.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-6">
        <Button asChild size="lg" className="font-medium">
          <Link href="/dashboard">
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="font-medium">
          <Link href="#how-it-works">
            See How It Works
          </Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground pt-2">Just 2% on sales · Cancel anytime</p>
    </motion.div>
  );
} 