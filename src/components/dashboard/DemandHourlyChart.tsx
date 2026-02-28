import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHourlyChartData } from "@/lib/demandPatterns";

export const DemandHourlyChart = () => {
  const today = new Date();
  const data = getHourlyChartData(today.getDay());
  const currentHour = `${today.getHours()}h`;

  return (
    <Card className="rounded-2xl border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Prevision horaire du jour</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: number) => [`${value}%`, "Intensite"]}
              />
              <ReferenceLine
                x={currentHour}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{ value: "Maintenant", position: "top", fontSize: 10, fill: "hsl(var(--primary))" }}
              />
              <Bar dataKey="intensite" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
