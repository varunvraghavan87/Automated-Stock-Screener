"use client";

import { useState, useMemo } from "react";
import { Navbar } from "@/components/layout/navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, Shield, TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function CalculatorPage() {
  const [equity, setEquity] = useState("1000000");
  const [riskPercent, setRiskPercent] = useState("1.5");
  const [entryPrice, setEntryPrice] = useState("145");
  const [stopLoss, setStopLoss] = useState("139.30");
  const [maxCapital, setMaxCapital] = useState("8");

  const calculation = useMemo(() => {
    const eq = parseFloat(equity) || 0;
    const entry = parseFloat(entryPrice) || 0;
    const stop = parseFloat(stopLoss) || 0;
    const risk = parseFloat(riskPercent) || 0;
    const maxCap = parseFloat(maxCapital) || 8;

    const riskAmount = (eq * risk) / 100;
    const riskPerShare = entry - stop;

    if (riskPerShare <= 0 || entry <= 0) {
      return {
        shares: 0,
        positionValue: 0,
        riskAmount: 0,
        riskPerShare: 0,
        target: 0,
        potentialProfit: 0,
        potentialLoss: 0,
        capitalUsed: 0,
        capitalUsedPct: 0,
        riskRewardRatio: 2,
        isCapped: false,
      };
    }

    let shares = Math.floor(riskAmount / riskPerShare);
    let positionValue = shares * entry;

    const maxPosition = (eq * maxCap) / 100;
    const isCapped = positionValue > maxPosition;
    if (isCapped) {
      shares = Math.floor(maxPosition / entry);
      positionValue = shares * entry;
    }

    const target = entry + riskPerShare * 2;
    const potentialProfit = shares * (target - entry);
    const potentialLoss = shares * riskPerShare;
    const capitalUsedPct = (positionValue / eq) * 100;

    return {
      shares,
      positionValue,
      riskAmount: potentialLoss,
      riskPerShare,
      target,
      potentialProfit,
      potentialLoss,
      capitalUsed: positionValue,
      capitalUsedPct,
      riskRewardRatio: 2,
      isCapped,
    };
  }, [equity, riskPercent, entryPrice, stopLoss, maxCapital]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Position Size Calculator</h1>
          <p className="text-muted-foreground">
            Fixed fractional position sizing with the Nifty Velocity Alpha risk
            framework
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Input Section */}
          <Card className="bg-card/50 backdrop-blur border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calculator className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Input Parameters</CardTitle>
                  <CardDescription>
                    Adjust values to calculate position size
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="equity">Account Equity</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="equity"
                    type="number"
                    value={equity}
                    onChange={(e) => setEquity(e.target.value)}
                    className="pl-7 bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk">Risk Per Trade (%)</Label>
                <Input
                  id="risk"
                  type="number"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 1.0-2.0% (Fixed fractional method)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry">Entry Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="entry"
                    type="number"
                    step="0.05"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="pl-7 bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sl">Stop Loss (1.5x ATR below entry)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="sl"
                    type="number"
                    step="0.05"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="pl-7 bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxcap">Max Capital Per Trade (%)</Label>
                <Input
                  id="maxcap"
                  type="number"
                  value={maxCapital}
                  onChange={(e) => setMaxCapital(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="p-4 bg-muted/30 rounded-lg border border-border mt-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Formula:</strong> Shares = (Equity x Risk%) / (Entry -
                  Stop Loss)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Output Section */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Calculated Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-background/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">
                      Number of Shares
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {calculation.shares.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-background/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">
                      Position Value
                    </p>
                    <p className="text-2xl font-bold text-accent">
                      {formatCurrency(calculation.positionValue)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-background/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">
                      Target Price (1:2 R:R)
                    </p>
                    <p className="text-xl font-bold text-[#f59e0b]">
                      {formatCurrency(calculation.target)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-background/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">
                      Risk Per Share
                    </p>
                    <p className="text-xl font-bold">
                      {formatCurrency(calculation.riskPerShare)}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-background/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Capital Used
                    </span>
                    <span className="font-mono">
                      {calculation.capitalUsedPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.min(calculation.capitalUsedPct, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {calculation.isCapped && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20">
                    <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                    <p className="text-xs text-[#f59e0b]">
                      Position capped at {maxCapital}% of equity
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* P&L Projection */}
            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                <CardTitle className="text-lg">P&L Projection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                    <p className="text-xs text-muted-foreground mb-1">
                      Max Profit (at target)
                    </p>
                    <p className="text-xl font-bold text-accent">
                      +{formatCurrency(calculation.potentialProfit)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-1">
                      Max Loss (at stop)
                    </p>
                    <p className="text-xl font-bold text-destructive">
                      -{formatCurrency(calculation.potentialLoss)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Controls */}
            <Card className="bg-card/50 backdrop-blur border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Risk Controls</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <RiskControl
                  label="Trade Risk"
                  value={`${riskPercent}% of equity`}
                  passed={parseFloat(riskPercent) <= 2}
                />
                <RiskControl
                  label="Capital Exposure"
                  value={`${calculation.capitalUsedPct.toFixed(1)}% of equity`}
                  passed={calculation.capitalUsedPct <= parseFloat(maxCapital)}
                />
                <RiskControl
                  label="Risk:Reward"
                  value="1:2 minimum"
                  passed={true}
                />
                <RiskControl
                  label="Trailing Stop"
                  value="Breakeven at +5%, then 20 EMA"
                  passed={true}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function RiskControl({
  label,
  value,
  passed,
}: {
  label: string;
  value: string;
  passed: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            passed ? "bg-accent" : "bg-destructive"
          }`}
        />
        <span className="text-sm">{label}</span>
      </div>
      <Badge variant="outline" className="text-xs">
        {value}
      </Badge>
    </div>
  );
}
