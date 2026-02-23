import { useMemo } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";

interface AreaChartProps {
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

function buildGradientFill(index: number) {
  const colors = [
    ["rgba(58, 77, 233, 0.8)", "rgba(58, 77, 233, 0.1)"],
    ["rgba(255, 112, 67, 0.8)", "rgba(255, 112, 67, 0.1)"],
    ["rgba(102, 187, 106, 0.8)", "rgba(102, 187, 106, 0.1)"],
    ["rgba(171, 71, 188, 0.8)", "rgba(171, 71, 188, 0.1)"],
    ["rgba(255, 202, 40, 0.8)", "rgba(255, 202, 40, 0.1)"],
  ];
  const [top, bottom] = colors[index % colors.length];
  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: top },
      { offset: 1, color: bottom },
    ],
  };
}

function AreaChart({
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
}: AreaChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const categories = data.map((d) => String(d[xField] ?? ""));

    if (series && series.length > 0) {
      const seriesData = series.map((name, i) => ({
        name,
        type: "line" as const,
        smooth,
        areaStyle: { color: buildGradientFill(i) },
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
      series: [
        {
          type: "line" as const,
          smooth,
          areaStyle: { color: buildGradientFill(0) },
          data: values,
        },
      ],
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

export type { AreaChartProps };
export default AreaChart;
