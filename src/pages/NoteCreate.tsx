import { zodResolver } from "@hookform/resolvers/zod";
import { navigate } from "raviger";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCreateNote } from "@/hooks/useNotes";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  facilityId: string;
}

// TODO: replace with your domain create page
export default function NoteCreate({ facilityId }: Props) {
  const { mutateAsync, isPending } = useCreateNote();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await mutateAsync({ facility_id: facilityId, ...values });
      toast.success("Note created successfully");
      navigate(`/facility/${facilityId}/notes`);
    } catch {
      toast.error("Failed to create note");
    }
  };

  return (
    <div className="p-4 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Create Note</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            {...register("title")}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Note title"
          />
          {errors.title && (
            <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Content</label>
          <textarea
            {...register("content")}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Note content..."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50 hover:bg-blue-700"
          >
            {isPending ? "Creating..." : "Create Note"}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/facility/${facilityId}/notes`)}
            className="border px-4 py-2 rounded text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
