export type UserRole = "seller" | "buyer" | "admin";
export type UserStatus = "active" | "suspended";
export type VerificationStatus = "unverified" | "pending" | "verified" | "failed";
/** Escrow.com stages an admin records (migration 0055). */
export type EscrowStage =
  | "escrow_opened"
  | "escrow_funded"
  | "inspection_passed"
  | "handed_to_shipper"
  | "escrow_released";
export type IdCountry = "NG" | "GH" | "TG" | "BJ";
export type IdMethod = "ng_nin" | "gh_card" | "document";
export type VehicleStatus = "draft" | "pending_review" | "approved" | "rejected" | "sold" | "archived";
export type VinVerificationStatus = "unverified" | "checking" | "verified" | "flagged";
export type ShippingMethod = "roro" | "container";
export type VehicleSizeType = "sedan" | "suv_truck";
/** waitlist_signups.audience — see waitlist_signups_audience_check (0046). */
export type WaitlistAudienceColumn = "buyer" | "seller" | "shipper" | "inspector" | "clearing_agent";
/** waitlist_signups.source — see waitlist_signups_source_check (0046). */
export type WaitlistSourceColumn =
  | "site"
  | "listing"
  | "dashboard"
  | "home"
  | "how_it_works"
  | "browse"
  | "sell"
  | "shipper"
  | "inspectors"
  | "clearing_agents";
export type PurchaseRequestStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "completed"
  | "cancelled"
  | "expired";
export type FeeResponsibility = "buyer_pays_full" | "split";
export type MovaFeePaymentStatus =
  | "pending"
  | "paid"
  | "pending_manual_verification"
  | "bank_transfer_rejected";
export type NegotiatedPriceStatus = "none" | "proposed" | "accepted";
export type PolicyAcceptanceContext = "signup" | "fee_payment";
export type TermsAcceptanceContext = "signup" | "login_gate";
export type ShipperStatus = "pending" | "approved" | "rejected";
export type ShipperPaymentStatus = "good_standing" | "past_due" | "suspended";
export type CommissionChargeStatus = "pending" | "charged" | "failed";
export type ShipmentRequestStatus = "pending" | "completed";
export type ReviewType = "buyer_to_seller" | "seller_to_buyer" | "buyer_to_shipper";
export type ReviewStatus = "pending" | "published" | "flagged" | "removed";
export type ReviewReportStatus = "open" | "reviewed" | "dismissed";
export type DisputeCategory =
  | "seller_unresponsive"
  | "vehicle_misrepresented"
  | "shipping_issue"
  | "other";
export type DisputeStatus =
  | "open"
  | "approved_pending_refund"
  | "denied"
  | "refund_completed";
export type ShipmentShippingStatus =
  | "awaiting_pickup"
  | "picked_up"
  | "in_transit"
  | "delivered";
export type ShipmentProofKind = "pickup" | "delivery";
export type ReferralRole = "buyer" | "seller";
export type ReferralFlagStatus = "clear" | "flagged";
export type ReferralPayoutStatus = "pending" | "processing" | "paid" | "failed";
export type ReferralPayoutMethod = "stripe_transfer" | "bank_transfer";

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
          referral_code: string;
          referred_by: string | null;
          signup_ip: string | null;
          signup_device_fingerprint: string | null;
          is_test_account: boolean;
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
          // referral_code is generated server-side by
          // users_generate_referral_code(); referred_by/signup_ip/
          // signup_device_fingerprint are resolved/copied by
          // handle_new_user() from signUp()'s raw_user_meta_data. None of
          // the four are ever set by app code directly.
          referral_code?: string;
          referred_by?: string | null;
          signup_ip?: string | null;
          signup_device_fingerprint?: string | null;
          is_test_account?: boolean;
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
          referral_code: string;
          referred_by: string | null;
          signup_ip: string | null;
          signup_device_fingerprint: string | null;
          is_test_account: boolean;
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
          policy_accepted_at: string | null;
          policy_version: string | null;
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
          policy_accepted_at?: string | null;
          policy_version?: string | null;
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
          policy_accepted_at: string | null;
          policy_version: string | null;
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
          policy_accepted_at: string | null;
          policy_version: string | null;
          id_country: IdCountry | null;
          id_method: IdMethod | null;
          id_legal_name: string | null;
          id_record_name: string | null;
          id_name_match: "match" | "close" | "mismatch" | null;
          id_document_type: "national_id" | "passport" | null;
          id_document_path: string | null;
          id_review_note: string | null;
          id_reviewed_by: string | null;
          id_reviewed_at: string | null;
          id_verified_at: string | null;
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
          policy_accepted_at?: string | null;
          policy_version?: string | null;
          id_country?: IdCountry | null;
          id_method?: IdMethod | null;
          id_legal_name?: string | null;
          id_record_name?: string | null;
          id_name_match?: "match" | "close" | "mismatch" | null;
          id_document_type?: "national_id" | "passport" | null;
          id_document_path?: string | null;
          id_review_note?: string | null;
          id_reviewed_by?: string | null;
          id_reviewed_at?: string | null;
          id_verified_at?: string | null;
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
          policy_accepted_at: string | null;
          policy_version: string | null;
          id_country: IdCountry | null;
          id_method: IdMethod | null;
          id_legal_name: string | null;
          id_record_name: string | null;
          id_name_match: "match" | "close" | "mismatch" | null;
          id_document_type: "national_id" | "passport" | null;
          id_document_path: string | null;
          id_review_note: string | null;
          id_reviewed_by: string | null;
          id_reviewed_at: string | null;
          id_verified_at: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          seller_id: string;
          /**
           * Not readable with the anon key (column-level SELECT, migration
           * 0037) — nor are title_photo_path / authorization_document_path.
           * Read them only through the `vehicle_vin` RPC or the secret-key
           * client (lib/supabase/admin.ts) after a server-side role check.
           */
          vin: string;
          vin_decode_status: "pending" | "matched" | "mismatch";
          vin_verification_status: VinVerificationStatus;
          /**
           * Stored generated columns (migration 0036) — never written by the
           * app, and Postgres rejects any value for them. `vin_masked` is
           * the public form of the VIN (last 6 characters); the full VIN is
           * only available through the `vehicle_vin` RPC. The two `has_*`
           * flags let the verification badges and review gates check that a
           * document exists without reading its private path.
           * Not present on Insert/Update.
           */
          vin_masked: string | null;
          /** VIN position 10, the model-year code (generated, 0044). Decoded by lib/import-rules.ts. */
          vin_model_year_code: string | null;
          has_title_document: boolean;
          has_authorization_document: boolean;
          /**
           * Derived from seller_profiles by vehicles_guard_admin_only_fields
           * on every write and kept current by a seller_profiles trigger
           * (0036). Any value the app sends is overwritten.
           */
          seller_identity_verified: boolean;
          vehicle_size_type: VehicleSizeType;
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
          title_photo_path: string | null;
          title_identity_match_confirmed: boolean;
          title_identity_match_confirmed_by: string | null;
          title_identity_match_confirmed_at: string | null;
          not_titled_owner: boolean;
          authorization_document_path: string | null;
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
          vehicle_size_type: VehicleSizeType;
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
          vin_verification_status?: VinVerificationStatus;
          trim?: string | null;
          exterior_color?: string | null;
          interior_color?: string | null;
          transmission?: string | null;
          fuel_type?: string | null;
          condition?: string | null;
          accident_history?: string | null;
          title_status?: string | null;
          title_history_check_status?: "not_run" | "pending" | "clean" | "branded";
          title_photo_path?: string | null;
          title_identity_match_confirmed?: boolean;
          title_identity_match_confirmed_by?: string | null;
          title_identity_match_confirmed_at?: string | null;
          not_titled_owner?: boolean;
          authorization_document_path?: string | null;
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
          vin_verification_status: VinVerificationStatus;
          vehicle_size_type: VehicleSizeType;
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
          title_photo_path: string | null;
          title_identity_match_confirmed: boolean;
          title_identity_match_confirmed_by: string | null;
          title_identity_match_confirmed_at: string | null;
          not_titled_owner: boolean;
          authorization_document_path: string | null;
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
      fx_rates: {
        Row: {
          currency: string;
          usd_rate: number;
          provider_updated_at: string;
          fetched_at: string;
        };
        Insert: {
          currency: string;
          usd_rate: number;
          provider_updated_at: string;
          fetched_at?: string;
        };
        Update: Partial<{
          currency: string;
          usd_rate: number;
          provider_updated_at: string;
          fetched_at: string;
        }>;
        Relationships: [];
      };
      vehicle_photos: {
        Row: {
          id: string;
          vehicle_id: string;
          url: string;
          thumb_url: string | null;
          sort_order: number;
          is_primary: boolean;
        };
        Insert: {
          vehicle_id: string;
          url: string;
          thumb_url?: string | null;
          id?: string;
          sort_order?: number;
          is_primary?: boolean;
        };
        Update: Partial<{
          id: string;
          vehicle_id: string;
          url: string;
          thumb_url: string | null;
          sort_order: number;
          is_primary: boolean;
        }>;
        Relationships: [];
      };
      policy_acceptances: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          context: PolicyAcceptanceContext;
          policy_version: string;
          purchase_request_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          accepted_at: string;
        };
        Insert: {
          user_id: string;
          context: PolicyAcceptanceContext;
          policy_version: string;
          id?: string;
          // role is derived server-side by the guard trigger — accepted here
          // only because the DB column is NOT NULL; whatever is sent is
          // overwritten.
          role?: UserRole;
          purchase_request_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          accepted_at?: string;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          role: UserRole;
          context: PolicyAcceptanceContext;
          policy_version: string;
          purchase_request_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          accepted_at: string;
        }>;
        Relationships: [];
      };
      /** Single-row pre-launch switch (0039). Read by everyone, updated by admins. */
      platform_settings: {
        Row: { id: boolean; prelaunch: boolean; updated_at: string };
        Insert: { id?: boolean; prelaunch?: boolean; updated_at?: string };
        Update: Partial<{ prelaunch: boolean; updated_at: string }>;
        Relationships: [];
      };
      /**
       * Pre-launch waitlist (0039). anon/authenticated may only insert the
       * five Insert columns; only admins can read rows (RLS).
       */
      waitlist_signups: {
        Row: {
          id: string;
          email: string | null;
          whatsapp: string | null;
          country: "NG" | "GH" | "TG" | "BJ" | "US" | "OTHER";
          vehicle_id: string | null;
          source: WaitlistSourceColumn;
          audience: WaitlistAudienceColumn;
          full_name: string | null;
          company: string | null;
          city_state: string | null;
          experience: string | null;
          ports_served: string[] | null;
          license_number: string | null;
          created_at: string;
        };
        Insert: {
          email?: string | null;
          whatsapp?: string | null;
          country: "NG" | "GH" | "TG" | "BJ" | "US" | "OTHER";
          vehicle_id?: string | null;
          source?: WaitlistSourceColumn;
          audience?: WaitlistAudienceColumn;
          full_name?: string | null;
          company?: string | null;
          city_state?: string | null;
          experience?: string | null;
          ports_served?: string[] | null;
          license_number?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      terms_acceptances: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          context: TermsAcceptanceContext;
          version: string;
          ip_address: string | null;
          user_agent: string | null;
          accepted_at: string;
        };
        Insert: {
          user_id: string;
          context: TermsAcceptanceContext;
          version: string;
          id?: string;
          // role is derived server-side by the guard trigger — accepted here
          // only because the DB column is NOT NULL; whatever is sent is
          // overwritten.
          role?: UserRole;
          ip_address?: string | null;
          user_agent?: string | null;
          accepted_at?: string;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          role: UserRole;
          context: TermsAcceptanceContext;
          version: string;
          ip_address: string | null;
          user_agent: string | null;
          accepted_at: string;
        }>;
        Relationships: [];
      };
      privacy_policy_acceptances: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          context: TermsAcceptanceContext;
          version: string;
          ip_address: string | null;
          user_agent: string | null;
          accepted_at: string;
        };
        Insert: {
          user_id: string;
          context: TermsAcceptanceContext;
          version: string;
          id?: string;
          // role is derived server-side by the guard trigger — accepted here
          // only because the DB column is NOT NULL; whatever is sent is
          // overwritten.
          role?: UserRole;
          ip_address?: string | null;
          user_agent?: string | null;
          accepted_at?: string;
        };
        Update: Partial<{
          id: string;
          user_id: string;
          role: UserRole;
          context: TermsAcceptanceContext;
          version: string;
          ip_address: string | null;
          user_agent: string | null;
          accepted_at: string;
        }>;
        Relationships: [];
      };
      vehicle_videos: {
        Row: {
          id: string;
          vehicle_id: string;
          url: string;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          vehicle_id: string;
          url: string;
          id?: string;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          vehicle_id: string;
          url: string;
          duration_seconds: number | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          seq: number;
          admin_id: string;
          action: string;
          target_table: string;
          target_id: string | null;
          details: Record<string, unknown>;
          created_at: string;
        };
        // Written only through log_admin_action() (0056).
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transaction_status_history: {
        Row: {
          id: string;
          seq: number;
          purchase_request_id: string;
          stage: string;
          from_stage: string | null;
          changed_by: string | null;
          note: string | null;
          created_at: string;
        };
        // Written only by database triggers (migration 0055); never by the app.
        Insert: never;
        Update: never;
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
          fee_payment_requested_at: string | null;
          payment_method: string | null;
          payment_reference: string | null;
          notes: string | null;
          assigned_admin_id: string | null;
          negotiated_price_usd: number | null;
          negotiated_price_status: NegotiatedPriceStatus;
          negotiated_price_proposed_at: string | null;
          negotiated_price_accepted_at: string | null;
          bank_transfer_proof_path: string | null;
          bank_transfer_proof_uploaded_at: string | null;
          bank_transfer_reviewed_by: string | null;
          bank_transfer_reviewed_at: string | null;
          bank_transfer_rejection_reason: string | null;
          reference: string;
          escrow_reference: string | null;
          escrow_stage: EscrowStage | null;
          mova_fee_payment_method_fingerprint: string | null;
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
          fee_payment_requested_at?: string | null;
          payment_method?: string | null;
          payment_reference?: string | null;
          notes?: string | null;
          assigned_admin_id?: string | null;
          negotiated_price_usd?: number | null;
          negotiated_price_status?: NegotiatedPriceStatus;
          negotiated_price_proposed_at?: string | null;
          negotiated_price_accepted_at?: string | null;
          bank_transfer_proof_path?: string | null;
          bank_transfer_proof_uploaded_at?: string | null;
          bank_transfer_reviewed_by?: string | null;
          bank_transfer_reviewed_at?: string | null;
          bank_transfer_rejection_reason?: string | null;
          reference?: string;
          escrow_reference?: string | null;
          escrow_stage?: EscrowStage | null;
          mova_fee_payment_method_fingerprint?: string | null;
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
          fee_payment_requested_at: string | null;
          payment_method: string | null;
          payment_reference: string | null;
          notes: string | null;
          assigned_admin_id: string | null;
          negotiated_price_usd: number | null;
          negotiated_price_status: NegotiatedPriceStatus;
          negotiated_price_proposed_at: string | null;
          negotiated_price_accepted_at: string | null;
          bank_transfer_proof_path: string | null;
          bank_transfer_proof_uploaded_at: string | null;
          bank_transfer_reviewed_by: string | null;
          bank_transfer_reviewed_at: string | null;
          bank_transfer_rejection_reason: string | null;
          reference: string;
          escrow_reference: string | null;
          escrow_stage: EscrowStage | null;
          mova_fee_payment_method_fingerprint: string | null;
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
          service_areas: string[];
          status: ShipperStatus;
          payment_status: ShipperPaymentStatus;
          terms_accepted_at: string | null;
          terms_version: string | null;
          is_test: boolean;
          stripe_customer_id: string | null;
          stripe_payment_method_id: string | null;
          card_on_file: boolean;
          reviewed_by: string | null;
          rejection_reason: string | null;
          reinstated_at: string | null;
          description: string | null;
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
          service_areas?: string[];
          status?: ShipperStatus;
          payment_status?: ShipperPaymentStatus;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          is_test?: boolean;
          stripe_customer_id?: string | null;
          stripe_payment_method_id?: string | null;
          card_on_file?: boolean;
          reviewed_by?: string | null;
          rejection_reason?: string | null;
          reinstated_at?: string | null;
          description?: string | null;
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
          service_areas: string[];
          status: ShipperStatus;
          payment_status: ShipperPaymentStatus;
          terms_accepted_at: string | null;
          terms_version: string | null;
          is_test: boolean;
          stripe_customer_id: string | null;
          stripe_payment_method_id: string | null;
          card_on_file: boolean;
          reviewed_by: string | null;
          rejection_reason: string | null;
          reinstated_at: string | null;
          description: string | null;
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
          vehicle_size_type: VehicleSizeType;
          shipping_method: ShippingMethod;
          price: number;
          currency: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          shipper_id: string;
          origin_region: string;
          destination_country: string;
          vehicle_size_type: VehicleSizeType;
          shipping_method: ShippingMethod;
          price: number;
          id?: string;
          origin_port?: string | null;
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
          vehicle_size_type: VehicleSizeType;
          shipping_method: ShippingMethod;
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
          purchase_request_id: string;
          agreed_rate: number;
          currency: string;
          commission_pct: number;
          commission_owed: number;
          commission_charge_status: CommissionChargeStatus;
          stripe_charge_id: string | null;
          status: ShipmentRequestStatus;
          shipping_status: ShipmentShippingStatus;
          shipping_status_updated_at: string | null;
          shipper_details_revealed_at: string | null;
          shipper_company_name: string | null;
          shipper_contact_name: string | null;
          shipper_contact_email: string | null;
          shipper_contact_phone: string | null;
          buyer_details_revealed_at: string | null;
          buyer_name: string | null;
          buyer_email: string | null;
          buyer_phone: string | null;
          buyer_whatsapp: string | null;
          vehicle_year: number | null;
          vehicle_make: string | null;
          vehicle_model: string | null;
          vehicle_trim: string | null;
          pickup_city: string | null;
          pickup_state: string | null;
          created_at: string;
        };
        Insert: {
          shipper_id: string;
          buyer_id: string;
          purchase_request_id: string;
          agreed_rate: number;
          id?: string;
          shipping_rate_id?: string | null;
          currency?: string;
          commission_pct?: number;
          commission_owed?: number;
          commission_charge_status?: CommissionChargeStatus;
          stripe_charge_id?: string | null;
          status?: ShipmentRequestStatus;
          shipping_status?: ShipmentShippingStatus;
          shipping_status_updated_at?: string | null;
          shipper_details_revealed_at?: string | null;
          shipper_company_name?: string | null;
          shipper_contact_name?: string | null;
          shipper_contact_email?: string | null;
          shipper_contact_phone?: string | null;
          buyer_details_revealed_at?: string | null;
          buyer_name?: string | null;
          buyer_email?: string | null;
          buyer_phone?: string | null;
          buyer_whatsapp?: string | null;
          vehicle_year?: number | null;
          vehicle_make?: string | null;
          vehicle_model?: string | null;
          vehicle_trim?: string | null;
          pickup_city?: string | null;
          pickup_state?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          shipper_id: string;
          shipping_rate_id: string | null;
          buyer_id: string;
          purchase_request_id: string;
          agreed_rate: number;
          currency: string;
          commission_pct: number;
          commission_owed: number;
          commission_charge_status: CommissionChargeStatus;
          stripe_charge_id: string | null;
          status: ShipmentRequestStatus;
          shipping_status: ShipmentShippingStatus;
          shipping_status_updated_at: string | null;
          shipper_details_revealed_at: string | null;
          shipper_company_name: string | null;
          shipper_contact_name: string | null;
          shipper_contact_email: string | null;
          shipper_contact_phone: string | null;
          buyer_details_revealed_at: string | null;
          buyer_name: string | null;
          buyer_email: string | null;
          buyer_phone: string | null;
          buyer_whatsapp: string | null;
          vehicle_year: number | null;
          vehicle_make: string | null;
          vehicle_model: string | null;
          vehicle_trim: string | null;
          pickup_city: string | null;
          pickup_state: string | null;
          created_at: string;
        }>;
        Relationships: [];
      };
      shipment_proof_photos: {
        Row: {
          id: string;
          shipment_request_id: string;
          kind: ShipmentProofKind;
          storage_path: string;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          shipment_request_id: string;
          kind: ShipmentProofKind;
          storage_path: string;
          uploaded_by: string;
          id?: string;
          created_at?: string;
        };
        Update: Partial<{
          shipment_request_id: string;
          kind: ShipmentProofKind;
          storage_path: string;
          uploaded_by: string;
          created_at: string;
        }>;
        Relationships: [];
      };
      shipment_updates: {
        Row: {
          id: string;
          shipment_request_id: string;
          author_id: string;
          note: string;
          created_at: string;
        };
        Insert: {
          shipment_request_id: string;
          author_id: string;
          note: string;
          id?: string;
          created_at?: string;
        };
        Update: Partial<{
          shipment_request_id: string;
          author_id: string;
          note: string;
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
      reviews: {
        Row: {
          id: string;
          review_type: ReviewType;
          reviewer_id: string;
          reviewee_id: string | null;
          reviewee_shipper_id: string | null;
          purchase_request_id: string | null;
          shipment_request_id: string | null;
          rating: number;
          comment: string | null;
          status: ReviewStatus;
          moderated_by: string | null;
          moderated_at: string | null;
          moderation_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          review_type: ReviewType;
          reviewer_id: string;
          rating: number;
          id?: string;
          reviewee_id?: string | null;
          reviewee_shipper_id?: string | null;
          purchase_request_id?: string | null;
          shipment_request_id?: string | null;
          comment?: string | null;
          status?: ReviewStatus;
          moderated_by?: string | null;
          moderated_at?: string | null;
          moderation_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          review_type: ReviewType;
          reviewer_id: string;
          reviewee_id: string | null;
          reviewee_shipper_id: string | null;
          purchase_request_id: string | null;
          shipment_request_id: string | null;
          rating: number;
          comment: string | null;
          status: ReviewStatus;
          moderated_by: string | null;
          moderated_at: string | null;
          moderation_note: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      review_reports: {
        Row: {
          id: string;
          review_id: string;
          reporter_id: string;
          reason: string | null;
          status: ReviewReportStatus;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          review_id: string;
          reporter_id: string;
          reason?: string | null;
          id?: string;
          status?: ReviewReportStatus;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          reason: string | null;
          status: ReviewReportStatus;
          resolved_by: string | null;
          resolved_at: string | null;
        }>;
        Relationships: [];
      };
      disputes: {
        Row: {
          id: string;
          purchase_request_id: string;
          reporter_id: string;
          category: DisputeCategory;
          description: string;
          evidence_paths: string[];
          status: DisputeStatus;
          decided_by: string | null;
          decision_reason: string | null;
          decision_amount_usd: number | null;
          decided_at: string | null;
          refund_completed_at: string | null;
          created_at: string;
        };
        Insert: {
          purchase_request_id: string;
          reporter_id: string;
          category: DisputeCategory;
          description: string;
          id?: string;
          evidence_paths?: string[];
          status?: DisputeStatus;
          decided_by?: string | null;
          decision_reason?: string | null;
          decision_amount_usd?: number | null;
          decided_at?: string | null;
          refund_completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          status: DisputeStatus;
          decided_by: string | null;
          decision_reason: string | null;
          decision_amount_usd: number | null;
          decided_at: string | null;
          refund_completed_at: string | null;
        }>;
        Relationships: [];
      };
      referral_payout_batches: {
        Row: {
          id: string;
          referrer_id: string;
          role: ReferralRole;
          batch_number: number;
          referral_count: number;
          amount_usd: number;
          method: ReferralPayoutMethod;
          status: ReferralPayoutStatus;
          payout_reference: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          failure_reason: string | null;
          created_at: string;
          paid_at: string | null;
        };
        Insert: {
          referrer_id: string;
          role: ReferralRole;
          batch_number: number;
          method: ReferralPayoutMethod;
          id?: string;
          referral_count?: number;
          amount_usd?: number;
          status?: ReferralPayoutStatus;
          payout_reference?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          paid_at?: string | null;
        };
        Update: Partial<{
          status: ReferralPayoutStatus;
          payout_reference: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          failure_reason: string | null;
          paid_at: string | null;
        }>;
        Relationships: [];
      };
      referral_credits: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          role: ReferralRole;
          purchase_request_id: string;
          email_pattern_match: boolean;
          phone_match: boolean;
          payment_fingerprint_match: boolean;
          device_fingerprint_match: boolean;
          ip_subnet_match: boolean;
          flag_status: ReferralFlagStatus;
          flag_reviewed_by: string | null;
          flag_reviewed_at: string | null;
          payout_batch_id: string | null;
          created_at: string;
        };
        Insert: {
          referrer_id: string;
          referred_id: string;
          role: ReferralRole;
          purchase_request_id: string;
          id?: string;
          email_pattern_match?: boolean;
          phone_match?: boolean;
          payment_fingerprint_match?: boolean;
          device_fingerprint_match?: boolean;
          ip_subnet_match?: boolean;
          flag_status?: ReferralFlagStatus;
          flag_reviewed_by?: string | null;
          flag_reviewed_at?: string | null;
          payout_batch_id?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          flag_status: ReferralFlagStatus;
          flag_reviewed_by: string | null;
          flag_reviewed_at: string | null;
          payout_batch_id: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: {
      referral_annual_payouts: {
        Row: {
          referrer_id: string | null;
          payout_year: number | null;
          method: ReferralPayoutMethod | null;
          batches_paid: number | null;
          total_paid_usd: number | null;
        };
        Relationships: [];
      };
      seller_ratings: {
        Row: {
          seller_id: string | null;
          avg_rating: number | null;
          review_count: number | null;
        };
        Relationships: [];
      };
      buyer_ratings: {
        Row: {
          buyer_id: string | null;
          avg_rating: number | null;
          review_count: number | null;
        };
        Relationships: [];
      };
      shipper_ratings: {
        Row: {
          shipper_id: string | null;
          avg_rating: number | null;
          review_count: number | null;
        };
        Relationships: [];
      };
      shipper_rates_public: {
        Row: {
          rate_id: string | null;
          shipper_id: string | null;
          company_name: string | null;
          service_areas: string[] | null;
          origin_region: string | null;
          origin_port: string | null;
          destination_country: string | null;
          vehicle_size_type: VehicleSizeType | null;
          shipping_method: ShippingMethod | null;
          price: number | null;
          currency: string | null;
          payment_status: ShipperPaymentStatus | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      /** What a seller may see about a buyer's ID check (0058); null if not allowed. */
      buyer_id_summary: {
        Args: { p_buyer_id: string };
        Returns: string | null;
      };
      /** Whether reserving needs a verified buyer ID (0057). */
      is_buyer_id_check_required: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      my_service_account_kind: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      /** Writes one admin audit entry as the calling admin (0056). */
      log_admin_action: {
        Args: {
          p_action: string;
          p_target_table: string;
          p_target_id: string | null;
          p_details?: Record<string, unknown>;
        };
        Returns: string;
      };
      /**
       * Full VIN for an admin, the listing's own seller, or a buyer whose
       * MOVA fee is paid and who has had seller details revealed; NULL for
       * everyone else. Permission-checked inside the function (0036).
       */
      vehicle_vin: {
        Args: { p_vehicle_id: string };
        Returns: string | null;
      };
      check_rate_limit: {
        Args: {
          p_bucket_key: string;
          p_max_count: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
