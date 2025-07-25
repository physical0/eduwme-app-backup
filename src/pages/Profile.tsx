import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router";
import { useAuth } from "../AuthContext";
import AvatarPlaceholder from "../assets/avatar_placeholder.jpg";
import LoadingPage from "@src/components/loading";

interface UserProfile {
  _id: string;
  username: string;
  nickname: string;
  biodata: string;
  xp: number;
  level: number;
  profilePicture?: string;
}

// Interface for inventory items
interface InventoryItem {
  itemId: string;
  dateAcquired: Date;
  isEquipped: boolean;
  details: {
    itemId: string;
    name: string;
    description: string;
    imageUrl?: string;
    price: number;
    category: "avatar" | "background" | "badge" | "theme" | "powerup";
    isAvailable: boolean;
  };
}

const ProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedNickname, setEditedNickname] = useState<string>("");
  const [editedBiodata, setEditedBiodata] = useState<string>("");
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const { user } = useAuth();
  
  // State for profile picture
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for banner image
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  // State for badge image
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState<string | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(false);

  const API_BASE_URL = 
    import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Check if the current user is viewing their own profile
  const isOwnProfile = user && userId === user._id;

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setError("User ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/users/getprofile/${userId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
          },
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Network response was not ok" }));
          throw new Error(
            errorData.message || `HTTP error! status: ${response.status}`,
          );
        }

        const data = await response.json();

        if (data && data.user) {
          setUserProfile(data.user);
          // Initialize edit fields with current values
          setEditedNickname(data.user.nickname || "");
          setEditedBiodata(data.user.biodata || "");
          
          // Set preview image if user has profile picture
          if (data.user.profilePicture) {
            setPreviewImage(data.user.profilePicture);
          }
        
          // fetch the user's inventory for banner and badge
          fetchUserInventory(data.user._id);
        } else {
          throw new Error("User data not found in API response.");
        }
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred.",
        );
        setUserProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, API_BASE_URL]);
  
  // Fetch user inventory to get equipped banner and badge
  const fetchUserInventory = async (userId: string) => {
    setIsLoadingInventory(true);
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/shop/userInventory/${userId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.inventory && data.inventory.length > 0) {
        // Find equipped banner (background)
        const equippedBanner = data.inventory.find(
          (item: InventoryItem) => item.details.category === "background" && item.isEquipped
        );
        
        if (equippedBanner && equippedBanner.details.imageUrl) {
          setBannerImage(equippedBanner.details.imageUrl);
        }
        
        // Find equipped badge
        const equippedBadge = data.inventory.find(
          (item: InventoryItem) => item.details.category === "badge" && item.isEquipped
        );
        
        if (equippedBadge && equippedBadge.details.imageUrl) {
          setBadgeImage(equippedBadge.details.imageUrl);
          setBadgeName(equippedBadge.details.name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch user inventory:", err);
      // We don't need to show this error to the user as it's not critical
    } finally {
      setIsLoadingInventory(false);
    }
  };

  // Add cleanup for object URLs when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup function to revoke any object URLs when component unmounts
      if (previewImage && previewImage.startsWith('blob:') && userProfile?.profilePicture !== previewImage) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage, userProfile]);

  const handleEditToggle = () => {
    if (isEditing) {
      // If canceling edit, reset form values
      setEditedNickname(userProfile?.nickname || "");
      setEditedBiodata(userProfile?.biodata || "");
      
      // Revoke previous object URL if it exists to prevent memory leaks
      if (previewImage && previewImage.startsWith('blob:') && userProfile?.profilePicture !== previewImage) {
        URL.revokeObjectURL(previewImage);
      }
      
      // Reset image selection if canceled
      if (userProfile?.profilePicture) {
        setPreviewImage(userProfile.profilePicture);
      } else {
        setPreviewImage(null);
      }
      setBase64Image(null);
      
      // Reset the file input value
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      setUpdateError(null);
    }
    setIsEditing(!isEditing);
    setUpdateSuccess(false);
  };

  // Improved compressImage function with better quality and size control
  // Modify your compressImage function to recursively try lower quality settings
  const compressImage = (file: File, maxWidth = 300, quality = 0.9, attempt = 1): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          // Calculate appropriate dimensions based on attempt number
          let width = img.width;
          let height = img.height;
          
          // Reduce dimensions more aggressively on subsequent attempts
          const currentMaxWidth = attempt > 1 ? maxWidth / attempt : maxWidth;
          
          // Calculate new dimensions while maintaining aspect ratio
          if (width > currentMaxWidth) {
            height = Math.round((height * currentMaxWidth) / width);
            width = currentMaxWidth;
          }
          
          // Ensure minimum dimensions (but smaller on later attempts)
          const minDimension = Math.max(100, 200 / attempt);
          width = Math.max(width, minDimension);
          height = Math.max(height, minDimension);
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Lower quality more aggressively with each attempt
          const finalQuality = Math.min(0.7, quality - (attempt * 0.1));
          
          canvas.toBlob(
            async (blob) => {
              if (blob) {
                // Check if the blob size is less than 30KB
                if (blob.size <= 30 * 1024) {
                  resolve(blob);
                } else if (attempt < 5) {
                  // Try again with more aggressive compression
                  try {
                    const smallerBlob = await compressImage(file, maxWidth, quality, attempt + 1);
                    resolve(smallerBlob);
                  } catch (err) {
                    reject(err);
                  }
                } else {
                  // Last resort: force a very small image
                  canvas.width = 200;
                  canvas.height = 200;
                  ctx?.drawImage(img, 0, 0, 200, 200);
                  canvas.toBlob(
                    (finalBlob) => {
                      if (finalBlob && finalBlob.size <= 30 * 1024) {
                        resolve(finalBlob);
                      } else {
                        reject(new Error('Unable to compress image below 30KB'));
                      }
                    },
                    'image/jpeg',
                    0.5
                  );
                }
              } else {
                reject(new Error('Canvas to Blob conversion failed'));
              }
            },
            'image/jpeg',
            finalQuality
          );
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
    });
  };

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Update handleImageChange function
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setUpdateError("Please select a valid image file (JPEG, PNG, GIF, WEBP)");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      
      try {
        // Show processing message
        setUpdateError("Processing image, please wait...");
        
        // Revoke previous object URL if it exists
        if (previewImage && previewImage.startsWith('blob:')) {
          URL.revokeObjectURL(previewImage);
        }
        
        // Create a preview URL (this is just for display)
        const previewURL = URL.createObjectURL(file);
        setPreviewImage(previewURL);
        
        // Initial compression settings - will be adjusted automatically if needed
        const initialMaxWidth = 600;
        const initialQuality = 0.8;
        
        // Compress the image with size target of 30KB
        const compressedBlob = await compressImage(file, initialMaxWidth, initialQuality);
        console.log(`Original size: ${file.size / 1024}KB, Compressed size: ${compressedBlob.size / 1024}KB`);
        
        // Convert compressed image to base64 for sending to the server
        const base64 = await blobToBase64(compressedBlob);
        setBase64Image(base64);
        
        // Clear any previous errors
        setUpdateError(null);
      } catch (err) {
        console.error("Error processing image:", err);
        setUpdateError(
          err instanceof Error ? err.message : "Failed to process the image. Please try another one."
        );
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  // Trigger file input click
  const handleImageClick = () => {
    if (isEditing && isOwnProfile && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Updated handleSubmit function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isOwnProfile) return;

    setIsSaving(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      // Check if base64Image is too large (3MB max in base64)
      if (base64Image && base64Image.length > 3 * 1024 * 1024) {
        throw new Error("Image is too large. Please select a smaller image.");
      }
      
      // Prepare update data without image first
      const updateData = {
        userId: userProfile._id,
        nickname: editedNickname,
        biodata: editedBiodata,
      };
      
      // If we have an image, add it separately (to help with debugging)
      const dataWithImage = base64Image 
        ? { ...updateData, profilePicture: base64Image }
        : updateData;

      // Log the data size being sent
      if (base64Image) {
        console.log(`Sending image data of size: ${Math.round(base64Image.length / 1024)}KB`);
      }

      const response = await fetch(`${API_BASE_URL}/users/updateProfile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(dataWithImage),
      });

      // Try to parse the response, but handle it gracefully if it fails
      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (error) {
        console.error("Failed to parse response:", error);
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}. The image may be too large.`);
        }
      }
      
      if (!response.ok) {
        throw new Error(
          (data && (data.error || data.message)) || 
          `Server error: ${response.status}. The image may be too large or in an invalid format.`
        );
      }
      
      // If we're here, the update was successful
      // Update the profile in state with the new data
      setUserProfile({
        ...userProfile,
        nickname: editedNickname,
        biodata: editedBiodata,
        // Only update profile picture if we actually changed it
        ...(base64Image && previewImage ? { profilePicture: previewImage } : {})
      });
      
      setUpdateSuccess(true);
      setIsEditing(false);
      
      // Reset file input after successful submission
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      setUpdateError(
        err instanceof Error ? err.message : "Failed to update profile."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state with responsive styling and dark mode support
  if (isLoading) {
    return <LoadingPage message="Loading profile..." fullScreen={false} />;
  }

  // Error state with responsive styling and dark mode support
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[70vh] p-4">
        <p className="text-lg sm:text-xl text-red-600 dark:text-red-400">Error loading profile:</p>
        <p className="text-sm sm:text-md text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/20 p-3 rounded-md mt-2 max-w-md">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm sm:text-base"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Not found state with responsive styling and dark mode support
  if (!userProfile) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300">User profile not found.</p>
      </div>
    );
  }

  return (
    // Reduced width and padding, more compact container
    <div className="w-[90%] max-w-xs sm:max-w-lg md:max-w-xl mx-auto px-1.5 py-3 md:py-6 pb-16 md:pb-12 
      shadow-sm md:shadow-lg rounded-lg mt-1 sm:mt-4 md:mt-6 dark:bg-gray-800/40">
      {/* Success message - smaller text and padding for mobile */}
      {updateSuccess && (
        <div className="mb-2 sm:mb-4 p-1.5 sm:p-3 bg-green-100 dark:bg-green-900/30 
          text-green-700 dark:text-green-400 rounded-md text-center text-xs sm:text-sm">
          Profile updated successfully!
        </div>
      )}
      
      {/* Error message - smaller text and padding for mobile */}
      {updateError && (
        <div className="mb-2 sm:mb-4 p-1.5 sm:p-3 bg-red-100 dark:bg-red-900/30 
          text-red-700 dark:text-red-400 rounded-md text-center text-xs sm:text-sm">
          Error: {updateError}
        </div>
      )}
      
      {/* Header section - more compact for mobile */}
      <div className="flex justify-between items-center mb-2 sm:mb-6">
        <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">
          Profile
        </h1>
        
        {/* Smaller button on mobile */}
        {isOwnProfile && (
          <button
            onClick={handleEditToggle}
            className={`px-2 py-1 sm:px-4 sm:py-2 rounded-md transition-colors text-xs sm:text-base ${
              isEditing 
                ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600" 
                : "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            }`}
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        )}
      </div>
      
      <div className="relative">
      {/* Banner section - display user's equipped banner */}
      <div className="w-full h-28 sm:h-36 md:h-44 rounded-t-lg overflow-hidden relative">
        {isLoadingInventory ? (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        ) : bannerImage ? (
          <img 
            src={bannerImage} 
            alt="Profile Banner" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20"></div>
        )}
      </div>
      
      {/* Profile image section - with overlap on banner */}
      <div className="flex flex-col items-center -mt-8 sm:-mt-10 md:-mt-12 relative z-10 mb-2 sm:mb-4 md:mb-6">
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className="hidden"
        />
        
        {/* Profile image with drop shadow for better visibility over banner */}
        <div 
          className={`relative w-16 h-16 sm:w-22 sm:h-22 md:w-26 md:h-26 mb-1.5 sm:mb-3 md:mb-4 
            ${isEditing && isOwnProfile ? 'cursor-pointer' : ''}`}
          onClick={handleImageClick}
        >
          <img
            src={previewImage || userProfile.profilePicture || AvatarPlaceholder}
            alt="User Avatar"
            className="w-16 h-16 sm:w-22 sm:h-22 md:w-26 md:h-26 rounded-full object-cover 
              border-3 border-white dark:border-gray-800 shadow-md"
          />
          
          {/* Overlay icon */}
          {isEditing && isOwnProfile && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 bg-opacity-40 rounded-full">
              <span className="text-white text-lg sm:text-2xl md:text-3xl"> {base64Image? <img src={base64Image} alt="Profile" className="w-full h-full object-cover rounded-full" /> : "👤"}</span>
            </div>
          )}
        </div>
        
        {/* Smaller text for upload button */}
        {isEditing && isOwnProfile && (
          <button
            type="button"
            onClick={handleImageClick}
            className=" text-blue-500 dark:text-blue-400 
              hover:text-blue-700 dark:hover:text-blue-300 text-[10px] sm:text-sm"
          >
            Change Photo
          </button>
        )}

        {/* Add size warning message here - only when an image has been selected */}
        {/* Add size warning message here - only when a NEW image has been selected */}
        {isEditing && isOwnProfile && previewImage && base64Image && (
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 
            mt-0 mb-2 text-center max-w-[200px] sm:max-w-[250px]">
            Images will be automatically compressed to under 30KB. 
            Simple images with good contrast work best.
          </p>
        )}
        
        {/* Username with badge */}
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 dark:text-white">
            {userProfile.username}
          </h2>
          
          {/* Badge display */}
          {badgeImage && (
            <div className="relative group">
              <img 
                src={badgeImage} 
                alt={badgeName || "User Badge"} 
                className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 object-contain" 
              />
              {/* Tooltip for badge name */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                {badgeName || "User Badge"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      
      {isEditing ? (
        /* Edit Form - more compact for mobile */
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-6">
          <div className="space-y-1 sm:space-y-2">
            <label className="block text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-base">Nickname</label>
            <input
              type="text"
              value={editedNickname}
              onChange={(e) => setEditedNickname(e.target.value)}
              className="w-full p-1.5 sm:p-3 border border-gray-300 dark:border-gray-600 rounded-md 
                focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-xs sm:text-base"
              placeholder="Enter a nickname"
            />
          </div>
          
          <div className="space-y-1 sm:space-y-2">
            <label className="block text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-base">Bio</label>
            <textarea
              value={editedBiodata}
              onChange={(e) => setEditedBiodata(e.target.value)}
              className="w-full p-1.5 sm:p-3 border border-gray-300 dark:border-gray-600 rounded-md 
                focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] sm:min-h-[120px] 
                dark:bg-gray-700 dark:text-white text-xs sm:text-base"
              placeholder="Tell us about yourself"
            />
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className={`px-3 sm:px-6 py-1 sm:py-2 bg-green-500 text-white rounded-md 
                hover:bg-green-600 transition-colors text-xs sm:text-base ${
                isSaving ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : (
        /* Display Profile Info - more compact for mobile */
        <div className="space-y-2 sm:space-y-4">
          <div className="p-2 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-md shadow-sm">
            <strong className="text-gray-600 dark:text-gray-400 text-xs sm:text-base">Nickname:</strong>
            <p className="text-gray-800 dark:text-gray-200 text-sm sm:text-lg">
              {userProfile.nickname || "No nickname set"}
            </p>
          </div>
          
          <div className="p-2 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-md shadow-sm">
            <strong className="text-gray-600 dark:text-gray-400 text-xs sm:text-base">Bio:</strong>
            <p className="text-gray-800 dark:text-gray-200 text-sm sm:text-lg whitespace-pre-wrap">
              {userProfile.biodata || "No bio provided."}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="p-2 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md shadow-sm text-center">
              <strong className="text-blue-600 dark:text-blue-400 block text-[10px] sm:text-sm">XP</strong>
              <p className="text-blue-800 dark:text-blue-300 text-lg sm:text-2xl font-semibold">
                {userProfile.xp}
              </p>
            </div>
            <div className="p-2 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-md shadow-sm text-center">
              <strong className="text-green-600 dark:text-green-400 block text-[10px] sm:text-sm">Level</strong>
              <p className="text-green-800 dark:text-green-300 text-lg sm:text-2xl font-semibold">
                {userProfile.level}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;