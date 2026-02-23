import { useMemo } from "react";
import EChart from "./EChart";
import type { EChartsOption } from "echarts";

interface PieChartProps {
  data: Record<string, unknown>[];
  nameField: string;
  valueField: string;
  donut?: boolean;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  renderer?: "canvas" | "svg";
}

function PieChart({ data, nameField, valueField, donut = false, title, className, style, loading, renderer }: PieChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const pieData = data.map((d) => ({
      name: String(d[nameField] ?? ""),
      value: Number(d[valueField]) || 0,
    }));

    return {
      title: title ? { text: title } : undefined,
      tooltip: {
        trigger: "item" as const,
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        orient: "vertical" as const,
        left: "left",
        data: pieData.map((d) => d.name),
      },
      series: [
        {
          type: "pie" as const,
          radius: donut ? ["40%", "70%"] : "70%",
          data: pieData,
          label: {
            formatter: "{b}: {d}%",
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };
  }, [data, nameField, valueField, donut, title]);

  return <EChart option={option} className={className} style={style} loading={loading} renderer={renderer} />;
}

export type { PieChartProps };
export default PieChart;
