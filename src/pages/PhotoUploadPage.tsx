import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Camera, Upload, Check, Loader2, Image as ImageIcon } from "lucide-react";

const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/photo-upload`;
const publicHeaders = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const PhotoUploadPage = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restaurantId || !token) {
      setError("Lien invalide");
      return;
    }
    fetch(`${endpoint}?token=${encodeURIComponent(token)}`, { headers: publicHeaders })
      .then(async (response) => {
        if (!response.ok) throw new Error("invalid_link");
        return response.json();
      })
      .then((data) => {
        setRestaurantName(data.restaurantName);
        setUploaded(data.photos ?? []);
        setAuthorized(true);
      })
      .catch(() => setError("Lien invalide ou expire"));
  }, [restaurantId, token]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !restaurantId) return;
    setUploading(true);

    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const form = new FormData();
      form.append("file", files[i]);
      const response = await fetch(`${endpoint}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: publicHeaders,
        body: form,
      });
      if (response.ok) {
        const data = await response.json();
        if (data.url) newUrls.push(data.url);
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
