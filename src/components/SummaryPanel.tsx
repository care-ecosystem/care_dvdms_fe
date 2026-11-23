import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const API_BASE = "https://care-staging.ohc.network/api/v1";

interface Props {
  recordId: string;
}

async function fetchSummary(recordId: string): Promise<any> {
  const token = localStorage.getItem("care_access_token");
  const res = await fetch(`${API_BASE}/summary/${recordId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export default function SummaryPanel({ recordId }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["summary", recordId],
    queryFn: () => fetchSummary(recordId),
  });

  if (isLoading) return <div style={{ padding: 8 }}>Loading...</div>;

  return (
    <div className="p-2" style={{ backgroundColor: "#0d9f6e" }}>
      <button onClick={() => setExpanded(!expanded)} className="h-5 w-5">
        <svg viewBox="0 0 16 16" />
      </button>
      <h3 className="text-[13px]">Record Summary</h3>
      {expanded && (
        <div dangerouslySetInnerHTML={{ __html: data?.notesHtml }} />
      )}
      {data?.items?.map((item: any) => (
        <p key={item.id} className="text-red-500">
          {item.label}: {item.value}
        </p>
      ))}
    </div>
  );
}
