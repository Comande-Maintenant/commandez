import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Camera, Upload, Check, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const PhotoUploadPage = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [searchParams] = useSearchParams();
  const key = searchParams.get("key");

  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verify access key (simple hash check)
  useEffect(() => {
    if (!restaurantId || !key) {
      setError("Lien invalide");
      return;
    }
    // Key is first 8 chars of restaurant ID reversed - simple but enough
    const expected = restaurantId.slice(0, 8).split("").reverse().join("");
    if (key !== expected) {
      setError("Lien invalide ou expire");
      return;
    }
    setAuthorized(true);

    // Fetch restaurant name
    supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurantId)
      .single()
      .then(({ data }) => {
        if (data) setRestaurantName(data.name);
      });

    // Load existing uploads
    supabase.storage
      .from("prospect-uploads")
      .list(restaurantId, { limit: 50 })
      .then(({ data }) => {
        if (data) {
          setUploaded(
            data.map(
              (f) =>
                `https://rbqgsxhkccbhqdmdtxwr.supabase.co/storage/v1/object/public/prospect-uploads/${restaurantId}/${f.name}`
            )
          );
        }
      });
  }, [restaurantId, key]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !restaurantId) return;
    setUploading(true);

    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${i}.${ext}`;
      const path = `${restaurantId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("prospect-uploads")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (!uploadError) {
        newUrls.push(
          `https://rbqgsxhkccbhqdmdtxwr.supabase.co/storage/v1/object/public/prospect-uploads/${path}`
        );
      } else {
        console.error("Upload error:", uploadError);
      }
    }

    setUploaded((prev) => [...prev, ...newUrls]);
    setUploading(false);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Ce lien n'est pas valide.</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {restaurantName || "Chargement..."}
        </p>
        <p className="text-xs text-gray-500">Ajout de photos</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Camera button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute("capture", "environment");
                fileInputRef.current.click();
              }
            }}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 active:scale-95 transition-transform"
          >
            <Camera className="h-8 w-8" />
            <span className="text-sm font-semibold">Prendre une photo</span>
          </button>

          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute("capture");
                fileInputRef.current.click();
              }
            }}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-blue-50 border-2 border-blue-200 text-blue-700 active:scale-95 transition-transform"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm font-semibold">Depuis la galerie</span>
          </button>
        </div>

        {uploading && (
          <div className="flex items-center justify-center gap-2 py-3">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <p className="text-sm text-gray-600">Envoi en cours...</p>
          </div>
        )}

        {/* Uploaded photos */}
        {uploaded.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-medium text-gray-900">
                {uploaded.length} photo{uploaded.length > 1 ? "s" : ""} envoyee{uploaded.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {uploaded.map((url, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {uploaded.length === 0 && !uploading && (
          <div className="text-center py-8">
            <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Prenez en photo la carte, le menu ou les produits</p>
            <p className="text-xs text-gray-400 mt-1">Les photos apparaitront sur l'ordinateur</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 text-center">
        <p className="text-[11px] text-gray-400">CommandeIci</p>
      </div>
    </div>
  );
};

export default PhotoUploadPage;
