import { useMemo } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";

interface BarChartProps {
  data: Record<string, unknown>[];
  xField: string;
  yField: string;
  title?: string;
  horizontal?: boolean;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  renderer?: "canvas" | "svg";
}

function BarChart({
  data,
  xField,
  yField,
  title,
  horizontal = false,
  className,
  style,
  loading,
  renderer,
}: BarChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const categories = data.map((d) => String(d[xField] ?? ""));
    const values = data.map((d) => Number(d[yField]) || 0);

    const categoryAxis = { type: "category" as const, data: categories };
    const valueAxis = { type: "value" as const };

    return {
      title: title ? { text: title } : undefined,
      tooltip: { trigger: "axis" },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: [{ type: "bar", data: values }],
    };
  }, [data, xField, yField, title, horizontal]);

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

export type { BarChartProps };
export default BarChart;
