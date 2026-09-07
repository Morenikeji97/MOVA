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
export type FeeResponsibility = "buyer_pays_full" | "split";
export type MovaFeePaymentStatus = "pending" | "paid";
export type ShipperStatus = "pending" | "approved" | "rejected";
export type ShipperPaymentStatus = "good_standing" | "past_due" | "suspended";
export type CommissionChargeStatus = "pending" | "charged" | "failed";
export type ShipmentRequestStatus = "pending" | "completed";

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
          fee_responsibility: FeeResponsibility;
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
          fee_responsibility?: FeeResponsibility;
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
          fee_responsibility: FeeResponsibility;
          description: string | null;
          status: VehicleStatus;
          verification_status: VerificationStatus;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      vehicle_photos: {
        Row: {
          id: string;
          vehicle_id: string;
          url: string;
          sort_order: number;
          is_primary: boolean;
        };
        Insert: {
          vehicle_id: string;
          url: string;
          id?: string;
          sort_order?: number;
          is_primary?: boolean;
        };
        Update: Partial<{
          id: string;
          vehicle_id: string;
          url: string;
          sort_order: number;
          is_primary: boolean;
        }>;
        Relationships: [];
      };
      purchase_requests: {
        Row: {
          id: string;
          vehicle_id: string;
          buyer_id: string;
          shipping_rate_id: string | null;
          status: PurchaseRequestStatus;
          vehicle_price_usd: number | null;
          mova_fee_usd: number | null;
          mova_fee_payment_status: MovaFeePaymentStatus;
          mova_fee_stripe_session_id: string | null;
          mova_fee_checkout_url: string | null;
          seller_details_revealed_at: string | null;
          seller_name: string | null;
          seller_email: string | null;
          seller_phone: string | null;
          seller_whatsapp: string | null;
          payment_method: string | null;
          payment_reference: string | null;
          notes: string | null;
          assigned_admin_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          vehicle_id: string;
          buyer_id: string;
          id?: string;
          shipping_rate_id?: string | null;
          status?: PurchaseRequestStatus;
          vehicle_price_usd?: number | null;
          mova_fee_usd?: number | null;
          mova_fee_payment_status?: MovaFeePaymentStatus;
          mova_fee_stripe_session_id?: string | null;
          mova_fee_checkout_url?: string | null;
          seller_details_revealed_at?: string | null;
          seller_name?: string | null;
          seller_email?: string | null;
          seller_phone?: string | null;
          seller_whatsapp?: string | null;
          payment_method?: string | null;
          payment_reference?: string | null;
          notes?: string | null;
          assigned_admin_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          id: string;
          vehicle_id: string;
          buyer_id: string;
          shipping_rate_id: string | null;
          status: PurchaseRequestStatus;
          vehicle_price_usd: number | null;
          mova_fee_usd: number | null;
          mova_fee_payment_status: MovaFeePaymentStatus;
          mova_fee_stripe_session_id: string | null;
          mova_fee_checkout_url: string | null;
          seller_details_revealed_at: string | null;
          seller_name: string | null;
          seller_email: string | null;
          seller_phone: string | null;
          seller_whatsapp: string | null;
          payment_method: string | null;
          payment_reference: string | null;
          notes: string | null;
          assigned_admin_id: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      shippers: {
        Row: {
          id: string;
          user_id: string | null;
          company_name: string;
          contact_name: string;
          contact_email: string;
          contact_phone: string | null;
          fmc_oti_license_number: string;
          service_countries: string[];
          status: ShipperStatus;
          payment_status: ShipperPaymentStatus;
          terms_accepted_at: string | null;
          stripe_customer_id: string | null;
          stripe_payment_method_id: string | null;
          card_on_file: boolean;
          reviewed_by: string | null;
          rejection_reason: string | null;
          reinstated_at: string | null;
          created_at: string;
        };
        Insert: {
          company_name: string;
          contact_name: string;
          contact_email: string;
          fmc_oti_license_number: string;
          id?: string;
          user_id?: string | null;
          contact_phone?: string | null;
          service_countries?: string[];
          status?: ShipperStatus;
          payment_status?: ShipperPaymentStatus;
          terms_accepted_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_method_id?: string | null;
          card_on_file?: boolean;
          reviewed_by?: string | null;
          rejection_reason?: string | null;
          reinstated_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          user_id: string | null;
          company_name: string;
          contact_name: string;
          contact_email: string;
          contact_phone: string | null;
          fmc_oti_license_number: string;
          service_countries: string[];
          status: ShipperStatus;
          payment_status: ShipperPaymentStatus;
          terms_accepted_at: string | null;
          stripe_customer_id: string | null;
          stripe_payment_method_id: string | null;
          card_on_file: boolean;
          reviewed_by: string | null;
          rejection_reason: string | null;
          reinstated_at: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      shipping_rates: {
        Row: {
          id: string;
          shipper_id: string;
          origin_region: string;
          origin_port: string | null;
          destination_country: string;
          vehicle_size_type: string | null;
          price: number;
          currency: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          shipper_id: string;
          origin_region: string;
          destination_country: string;
          price: number;
          id?: string;
          origin_port?: string | null;
          vehicle_size_type?: string | null;
          currency?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          shipper_id: string;
          origin_region: string;
          origin_port: string | null;
          destination_country: string;
          vehicle_size_type: string | null;
          price: number;
          currency: string;
          active: boolean;
          created_at: string;
        }>;
        Relationships: [];
      };
      shipment_requests: {
        Row: {
          id: string;
          shipper_id: string;
          shipping_rate_id: string | null;
          buyer_id: string;
          agreed_rate: number;
          currency: string;
          commission_pct: number;
          commission_owed: number;
          commission_charge_status: CommissionChargeStatus;
          stripe_charge_id: string | null;
          status: ShipmentRequestStatus;
          shipper_details_revealed_at: string | null;
          shipper_company_name: string | null;
          shipper_contact_name: string | null;
          shipper_contact_email: string | null;
          shipper_contact_phone: string | null;
          created_at: string;
        };
        Insert: {
          shipper_id: string;
          buyer_id: string;
          agreed_rate: number;
          id?: string;
          shipping_rate_id?: string | null;
          currency?: string;
          commission_pct?: number;
          commission_owed?: number;
          commission_charge_status?: CommissionChargeStatus;
          stripe_charge_id?: string | null;
          status?: ShipmentRequestStatus;
          shipper_details_revealed_at?: string | null;
          shipper_company_name?: string | null;
          shipper_contact_name?: string | null;
          shipper_contact_email?: string | null;
          shipper_contact_phone?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          shipper_id: string;
          shipping_rate_id: string | null;
          buyer_id: string;
          agreed_rate: number;
          currency: string;
          commission_pct: number;
          commission_owed: number;
          commission_charge_status: CommissionChargeStatus;
          stripe_charge_id: string | null;
          status: ShipmentRequestStatus;
          shipper_details_revealed_at: string | null;
          shipper_company_name: string | null;
          shipper_contact_name: string | null;
          shipper_contact_email: string | null;
          shipper_contact_phone: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          vehicle_id: string;
          buyer_id: string;
          seller_id: string;
          buyer_last_read_at: string | null;
          seller_last_read_at: string | null;
          created_at: string;
        };
        Insert: {
          vehicle_id: string;
          buyer_id: string;
          seller_id: string;
          id?: string;
          buyer_last_read_at?: string | null;
          seller_last_read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          vehicle_id: string;
          buyer_id: string;
          seller_id: string;
          buyer_last_read_at: string | null;
          seller_last_read_at: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          blocked_attempt: boolean;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          sender_id: string;
          content: string;
          id?: string;
          blocked_attempt?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          blocked_attempt: boolean;
          created_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: {
      shipper_rates_public: {
        Row: {
          rate_id: string | null;
          shipper_id: string | null;
          company_name: string | null;
          origin_region: string | null;
          origin_port: string | null;
          destination_country: string | null;
          vehicle_size_type: string | null;
          price: number | null;
          currency: string | null;
          payment_status: ShipperPaymentStatus | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
