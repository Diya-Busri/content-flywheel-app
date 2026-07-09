"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/nextjs";

/**
 * Payment status alert component. Uses GET /api/payment-status so it works on every page
 * without relying on server actions (which can 404 when the action is not bound to the current route).
 * Only shows when payment has failed and user is not on the pricing page.
 */
export function PaymentStatusAlert() {
  const [hasPaymentFailed, setHasPaymentFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const { userId } = useAuth();

  const isVisible = pathname !== "/pricing";

  useEffect(() => {
    if (!userId || !isVisible) return;

    const checkPaymentStatus = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/payment-status", { method: "GET" });
        const data = res.ok ? await res.json() : { paymentFailed: false };
        setHasPaymentFailed(data.paymentFailed === true);
      } catch (error) {
        console.error("Error checking payment status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkPaymentStatus();
    const intervalId = setInterval(checkPaymentStatus, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [userId, isVisible]);
  
  // Show nothing while loading or if no payment issues
  if (isLoading || !hasPaymentFailed || !isVisible) {
    return null;
  }
  
  return (
    <Alert variant="destructive" className="mb-4 container mx-auto mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Payment Failed</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          Your subscription payment has failed. Your account has been temporarily downgraded to the free plan.
        </div>
        <div className="flex-shrink-0">
          <Button variant="outline" asChild>
            <Link href="/pricing">
              Update Payment Method
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
} 