import { useParams } from "react-router-dom";

function DashboardPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-600">
        {id ? `Viewing dashboard ${id}` : "Select or create a dashboard"}
      </p>
    </div>
  );
}

export default DashboardPage;
