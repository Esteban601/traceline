export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bitacora: {
        Row: {
          accion: string
          created_at: string
          detalle: Json
          entidad: string
          entidad_id: string | null
          id: string
          tenant_id: string | null
          usuario_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          detalle?: Json
          entidad: string
          entidad_id?: string | null
          id?: string
          tenant_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          detalle?: Json
          entidad?: string
          entidad_id?: string | null
          id?: string
          tenant_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      capturas_valor: {
        Row: {
          capturado_por: string
          confirmado: boolean
          created_at: string
          evidencia_id: string
          id: string
          justificacion: string | null
          periodo: string | null
          solicitud_id: string
          unidad: string
          valor: number
        }
        Insert: {
          capturado_por: string
          confirmado?: boolean
          created_at?: string
          evidencia_id: string
          id?: string
          justificacion?: string | null
          periodo?: string | null
          solicitud_id: string
          unidad: string
          valor: number
        }
        Update: {
          capturado_por?: string
          confirmado?: boolean
          created_at?: string
          evidencia_id?: string
          id?: string
          justificacion?: string | null
          periodo?: string | null
          solicitud_id?: string
          unidad?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "capturas_valor_capturado_por_fkey"
            columns: ["capturado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capturas_valor_evidencia_id_fkey"
            columns: ["evidencia_id"]
            isOneToOne: false
            referencedRelation: "evidencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capturas_valor_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios: {
        Row: {
          autor_id: string
          contenido: string
          created_at: string
          es_observacion: boolean
          id: string
          solicitud_id: string
        }
        Insert: {
          autor_id: string
          contenido: string
          created_at?: string
          es_observacion?: boolean
          id?: string
          solicitud_id: string
        }
        Update: {
          autor_id?: string
          contenido?: string
          created_at?: string
          es_observacion?: boolean
          id?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      datapoints_taxonomia: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string
          id: string
          norma: Database["public"]["Enums"]["norma_niif"]
          ods: string | null
          pilar: Database["public"]["Enums"]["pilar_niif"]
          seccion_indice: string | null
          version_taxonomia: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion: string
          id?: string
          norma: Database["public"]["Enums"]["norma_niif"]
          ods?: string | null
          pilar: Database["public"]["Enums"]["pilar_niif"]
          seccion_indice?: string | null
          version_taxonomia?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string
          id?: string
          norma?: Database["public"]["Enums"]["norma_niif"]
          ods?: string | null
          pilar?: Database["public"]["Enums"]["pilar_niif"]
          seccion_indice?: string | null
          version_taxonomia?: string
        }
        Relationships: []
      }
      evidencias: {
        Row: {
          archivo_path: string
          area_origen: string | null
          created_at: string
          id: string
          justificacion: string | null
          nombre_original: string
          notas: string | null
          periodo_cubierto: string | null
          solicitud_id: string
          subido_por: string
          version: number
        }
        Insert: {
          archivo_path: string
          area_origen?: string | null
          created_at?: string
          id?: string
          justificacion?: string | null
          nombre_original: string
          notas?: string | null
          periodo_cubierto?: string | null
          solicitud_id: string
          subido_por: string
          version: number
        }
        Update: {
          archivo_path?: string
          area_origen?: string | null
          created_at?: string
          id?: string
          justificacion?: string | null
          nombre_original?: string
          notas?: string | null
          periodo_cubierto?: string | null
          solicitud_id?: string
          subido_por?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      mapeo_solicitud_datapoint: {
        Row: {
          created_at: string
          datapoint_id: string
          solicitud_id: string
        }
        Insert: {
          created_at?: string
          datapoint_id: string
          solicitud_id: string
        }
        Update: {
          created_at?: string
          datapoint_id?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapeo_solicitud_datapoint_datapoint_id_fkey"
            columns: ["datapoint_id"]
            isOneToOne: false
            referencedRelation: "datapoints_taxonomia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapeo_solicitud_datapoint_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles_usuario: {
        Row: {
          activo: boolean
          area: string | null
          created_at: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          tenant_id: string | null
        }
        Insert: {
          activo?: boolean
          area?: string | null
          created_at?: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          tenant_id?: string | null
        }
        Update: {
          activo?: boolean
          area?: string | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_usuario_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas: {
        Row: {
          created_at: string
          creado_por: string | null
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_solicitudes: {
        Row: {
          area_asignada: string | null
          created_at: string
          datapoint_ids: string[]
          descripcion: string | null
          es_cuantitativa: boolean
          id: string
          orden: number
          plantilla_id: string
          titulo: string
          unidad_esperada: string | null
        }
        Insert: {
          area_asignada?: string | null
          created_at?: string
          datapoint_ids?: string[]
          descripcion?: string | null
          es_cuantitativa?: boolean
          id?: string
          orden?: number
          plantilla_id: string
          titulo: string
          unidad_esperada?: string | null
        }
        Update: {
          area_asignada?: string | null
          created_at?: string
          datapoint_ids?: string[]
          descripcion?: string | null
          es_cuantitativa?: boolean
          id?: string
          orden?: number
          plantilla_id?: string
          titulo?: string
          unidad_esperada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_solicitudes_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas"
            referencedColumns: ["id"]
          },
        ]
      }
      reportes: {
        Row: {
          created_at: string
          ejercicio: number
          estado: Database["public"]["Enums"]["estado_reporte"]
          fecha_congelamiento: string | null
          id: string
          nombre: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          ejercicio: number
          estado?: Database["public"]["Enums"]["estado_reporte"]
          fecha_congelamiento?: string | null
          id?: string
          nombre: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          ejercicio?: number
          estado?: Database["public"]["Enums"]["estado_reporte"]
          fecha_congelamiento?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reportes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes: {
        Row: {
          area_asignada: string | null
          created_at: string
          descripcion: string | null
          es_cuantitativa: boolean
          estado: Database["public"]["Enums"]["estado_solicitud"]
          fecha_limite: string | null
          id: string
          orden: number
          reporte_id: string
          responsable_cliente_id: string | null
          responsable_irstrat_id: string | null
          titulo: string
          unidad_esperada: string | null
        }
        Insert: {
          area_asignada?: string | null
          created_at?: string
          descripcion?: string | null
          es_cuantitativa?: boolean
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          fecha_limite?: string | null
          id?: string
          orden?: number
          reporte_id: string
          responsable_cliente_id?: string | null
          responsable_irstrat_id?: string | null
          titulo: string
          unidad_esperada?: string | null
        }
        Update: {
          area_asignada?: string | null
          created_at?: string
          descripcion?: string | null
          es_cuantitativa?: boolean
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          fecha_limite?: string | null
          id?: string
          orden?: number
          reporte_id?: string
          responsable_cliente_id?: string | null
          responsable_irstrat_id?: string | null
          titulo?: string
          unidad_esperada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_responsable_cliente_id_fkey"
            columns: ["responsable_cliente_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_responsable_irstrat_id_fkey"
            columns: ["responsable_irstrat_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_current_area: { Args: never; Returns: string }
      fn_current_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      fn_current_tenant: { Args: never; Returns: string }
      fn_is_staff: { Args: never; Returns: boolean }
      fn_log_correo: {
        Args: {
          p_accion: string
          p_detalle: Json
          p_entidad_id: string
          p_tenant_id: string
          p_usuario_id: string
        }
        Returns: string
      }
      fn_log_evento: {
        Args: {
          p_accion: string
          p_detalle: Json
          p_entidad: string
          p_entidad_id: string
          p_tenant_id: string
          p_usuario_id: string
        }
        Returns: string
      }
      fn_puede_ver_solicitud: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      fn_tenant_de_solicitud: {
        Args: { p_solicitud_id: string }
        Returns: string
      }
    }
    Enums: {
      estado_reporte: "activo" | "congelado"
      estado_solicitud:
        | "pendiente"
        | "solicitado"
        | "recibido"
        | "en_revision"
        | "observaciones"
        | "validado"
        | "congelado"
      norma_niif: "S1" | "S2"
      pilar_niif: "gobernanza" | "estrategia" | "riesgos" | "metricas"
      rol_usuario: "cliente" | "coordinador" | "analista" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_reporte: ["activo", "congelado"],
      estado_solicitud: [
        "pendiente",
        "solicitado",
        "recibido",
        "en_revision",
        "observaciones",
        "validado",
        "congelado",
      ],
      norma_niif: ["S1", "S2"],
      pilar_niif: ["gobernanza", "estrategia", "riesgos", "metricas"],
      rol_usuario: ["cliente", "coordinador", "analista", "admin"],
    },
  },
} as const

