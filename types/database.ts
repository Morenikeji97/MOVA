export type UserRole = "seller" | "buyer" | "admin";
export type UserStatus = "active" | "suspended";
export type VerificationStatus = "unverified" | "pending" | "verified" | "failed";
export type VehicleStatus = "draft" | "pending_review" | "approved" | "rejected" | "sold" | "archived";
export type ShippingMethod = "roro" | "container";
export type PurchaseRequestStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "completed"
  | "cancelled";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          whatsapp_number: string | null;
          role: UserRole;
          status: UserStatus;
          email_verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: UserRole;
          phone?: string | null;
          whatsapp_number?: string | null;
          status?: UserStatus;
          email_verified_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          email: string;
          phone: string | null;
          whatsapp_number: string | null;
          role: UserRole;
          status: UserStatus;
          email_verified_at: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      seller_profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          country: string | null;
          id_document_url: string | null;
          id_verification_provider_ref: string | null;
          id_verification_status: VerificationStatus;
          id_verified_at: string | null;
          verification_status: VerificationStatus;
          created_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          country?: string | null;
          id_document_url?: string | null;
          id_verification_provider_ref?: string | null;
          id_verification_status?: VerificationStatus;
          id_verified_at?: string | null;
          verification_status?: VerificationStatus;
          created_at?: string;
        };
        Update: Partial<{
          user_id: string;
          full_name: string | null;
          country: string | null;
          id_document_url: string | null;
          id_verification_provider_ref: string | null;
          id_verification_status: VerificationStatus;
          id_verified_at: string | null;
          verification_status: VerificationStatus;
          created_at: string;
        }>;
        Relationships: [];
      };
      buyer_profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          country: string | null;
          city: string | null;
          nin_verification_status: VerificationStatus;
          nin_verification_ref: string | null;
          bvn_verification_status: VerificationStatus;
          bvn_verification_ref: string | null;
          verification_status: VerificationStatus;
          created_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          country?: string | null;
          city?: string | null;
          nin_verification_status?: VerificationStatus;
          nin_verification_ref?: string | null;
          bvn_verification_status?: VerificationStatus;
          bvn_verification_ref?: string | null;
          verification_status?: VerificationStatus;
          created_at?: string;
        };
        Update: Partial<{
          user_id: string;
          full_name: string | null;
          country: string | null;
          city: string | null;
          nin_verification_status: VerificationStatus;
          nin_verification_ref: string | null;
          bvn_verification_status: VerificationStatus;
          bvn_verification_ref: string | null;
          verification_status: VerificationStatus;
          created_at: string;
        }>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          seller_id: string;
          vin: string;
          vin_decode_status: "pending" | "matched" | "mismatch";
          year: number;
          make: string;
          model: string;
          trim: string | null;
          mileage: number;
          exterior_color: string | null;
          interior_color: string | null;
          transmission: string | null;
          fuel_type: string | null;
          condition: string | null;
          accident_history: string | null;
          title_status: string | null;
          title_history_check_status: "not_run" | "pending" | "clean" | "branded";
          location_city: string;
          location_state: string;
          price_usd: number;
          description: string | null;
          status: VehicleStatus;
          verification_status: VerificationStatus;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          seller_id: string;
          vin: string;
          year: number;
          make: string;
          model: string;
          mileage: number;
          location_city: string;
          location_state: string;
          price_usd: number;
          id?: string;
          vin_decode_status?: "pending" | "matched" | "mismatch";
          trim?: string | null;
          exterior_color?: string | null;
          interior_color?: string | null;
          transmission?: string | null;
          fuel_type?: string | null;
          condition?: string | null;
          accident_history?: string | null;
          title_status?: string | null;
          title_history_check_status?: "not_run" | "pending" | "clean" | "branded";
          description?: string | null;
          status?: VehicleStatus;
          verification_status?: VerificationStatus;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          seller_id: string;
          vin: string;
          vin_decode_status: "pending" | "matched" | "mismatch";
          year: number;
          make: string;
          model: string;
          trim: string | null;
          mileage: number;
          exterior_color: string | null;
          interior_color: string | null;
          transmission: string | null;
          fuel_type: string | null;
          condition: string | null;
          accident_history: string | null;
          title_status: string | null;
          title_history_check_status: "not_run" | "pending" | "clean" | "branded";
          location_city: string;
          location_state: string;
          price_usd: number;
          description: string | null;
          status: VehicleStatus;
          verification_status: VerificationStatus;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
