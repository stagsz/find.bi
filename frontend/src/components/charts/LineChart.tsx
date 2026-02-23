import { useMemo } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";

interface LineChartProps {
  data: Record<string, unknown>[];
  xField: string;
  yField: string;
  series?: string[];
  title?: string;
  smooth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  renderer?: "canvas" | "svg";
}

function LineChart({
  data,
  xField,
  yField,
  series,
  title,
  smooth = false,
  className,
  style,
  loading,
  renderer,
}: LineChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const categories = data.map((d) => String(d[xField] ?? ""));

    if (series && series.length > 0) {
      const seriesData = series.map((name) => ({
        name,
        type: "line" as const,
        smooth,
        data: data.map((d) => {
          const row = d as Record<string, unknown>;
          return Number(row[name]) || 0;
        }),
      }));

      return {
        title: title ? { text: title } : undefined,
        tooltip: { trigger: "axis" },
        legend: { data: series },
        xAxis: { type: "category" as const, data: categories },
        yAxis: { type: "value" as const },
        series: seriesData,
      };
    }

    const values = data.map((d) => Number(d[yField]) || 0);

    return {
      title: title ? { text: title } : undefined,
      tooltip: { trigger: "axis" },
      xAxis: { type: "category" as const, data: categories },
      yAxis: { type: "value" as const },
      series: [{ type: "line" as const, smooth, data: values }],
    };
  }, [data, xField, yField, series, title, smooth]);

  return (
    <EChart
      option={option}
      className={className}
      style={style}
      loading={loading}
      renderer={renderer}
    />
  );
}

export type { LineChartProps };
export default LineChart;
