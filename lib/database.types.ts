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
      areas_tenant: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          orden: number
          tenant_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          tenant_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_tenant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cuestionarios_respuestas: {
        Row: {
          created_at: string
          hoja: string
          id: string
          notas: string | null
          pregunta_orden: number
          reporte_id: string
          respuesta: string | null
          tipo_dato: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hoja: string
          id?: string
          notas?: string | null
          pregunta_orden: number
          reporte_id: string
          respuesta?: string | null
          tipo_dato?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hoja?: string
          id?: string
          notas?: string | null
          pregunta_orden?: number
          reporte_id?: string
          respuesta?: string | null
          tipo_dato?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuestionarios_respuestas_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
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
          marco: string
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
          marco?: string
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
          marco?: string
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
          cargado_por_staff: boolean
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
          cargado_por_staff?: boolean
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
          cargado_por_staff?: boolean
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
      invitaciones: {
        Row: {
          creada_por: string | null
          created_at: string
          expira_en: string
          id: string
          perfil_id: string
          tenant_id: string
          token_hash: string
          usada_en: string | null
        }
        Insert: {
          creada_por?: string | null
          created_at?: string
          expira_en: string
          id?: string
          perfil_id: string
          tenant_id: string
          token_hash: string
          usada_en?: string | null
        }
        Update: {
          creada_por?: string | null
          created_at?: string
          expira_en?: string
          id?: string
          perfil_id?: string
          tenant_id?: string
          token_hash?: string
          usada_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_creada_por_fkey"
            columns: ["creada_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mapeo_export: {
        Row: {
          activo: boolean
          anio_offset: number | null
          celda: string
          celda_nota: string | null
          created_at: string
          datapoint_id: string | null
          etiqueta: string | null
          hoja: string
          id: string
          rubro_clave: string | null
        }
        Insert: {
          activo?: boolean
          anio_offset?: number | null
          celda: string
          celda_nota?: string | null
          created_at?: string
          datapoint_id?: string | null
          etiqueta?: string | null
          hoja: string
          id?: string
          rubro_clave?: string | null
        }
        Update: {
          activo?: boolean
          anio_offset?: number | null
          celda?: string
          celda_nota?: string | null
          created_at?: string
          datapoint_id?: string | null
          etiqueta?: string | null
          hoja?: string
          id?: string
          rubro_clave?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapeo_export_datapoint_id_fkey"
            columns: ["datapoint_id"]
            isOneToOne: false
            referencedRelation: "datapoints_taxonomia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapeo_export_rubro_clave_fkey"
            columns: ["rubro_clave"]
            isOneToOne: false
            referencedRelation: "rubros_taxonomia"
            referencedColumns: ["clave"]
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
      objetivos: {
        Row: {
          activo: boolean
          alineacion_acuerdo_internacional: string | null
          ambito: string
          created_at: string
          descripcion: string | null
          hito_intermedio: string | null
          id: string
          meta: string | null
          metrica: string | null
          naturaleza: string
          nombre: string
          orden: number
          parte_entidad: string | null
          periodo_aplicacion: string | null
          periodo_base: string | null
          reporte_id: string
          tipo: string | null
          tipo_objetivo: string | null
        }
        Insert: {
          activo?: boolean
          alineacion_acuerdo_internacional?: string | null
          ambito: string
          created_at?: string
          descripcion?: string | null
          hito_intermedio?: string | null
          id?: string
          meta?: string | null
          metrica?: string | null
          naturaleza?: string
          nombre: string
          orden?: number
          parte_entidad?: string | null
          periodo_aplicacion?: string | null
          periodo_base?: string | null
          reporte_id: string
          tipo?: string | null
          tipo_objetivo?: string | null
        }
        Update: {
          activo?: boolean
          alineacion_acuerdo_internacional?: string | null
          ambito?: string
          created_at?: string
          descripcion?: string | null
          hito_intermedio?: string | null
          id?: string
          meta?: string | null
          metrica?: string | null
          naturaleza?: string
          nombre?: string
          orden?: number
          parte_entidad?: string | null
          periodo_aplicacion?: string | null
          periodo_base?: string | null
          reporte_id?: string
          tipo?: string | null
          tipo_objetivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objetivos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
        ]
      }
      objetivos_detalle: {
        Row: {
          alcances_cubiertos: string | null
          analisis_tendencias: string | null
          bruto_neto: string | null
          created_at: string
          enfoque_descarbonizacion: string | null
          gases_cubiertos: string | null
          id: string
          metricas_supervision: string | null
          notas: string | null
          objetivo_id: string
          procesos_revision: string | null
          resultados: string | null
          revisiones: string | null
          updated_at: string
          validacion_tercero: string | null
        }
        Insert: {
          alcances_cubiertos?: string | null
          analisis_tendencias?: string | null
          bruto_neto?: string | null
          created_at?: string
          enfoque_descarbonizacion?: string | null
          gases_cubiertos?: string | null
          id?: string
          metricas_supervision?: string | null
          notas?: string | null
          objetivo_id: string
          procesos_revision?: string | null
          resultados?: string | null
          revisiones?: string | null
          updated_at?: string
          validacion_tercero?: string | null
        }
        Update: {
          alcances_cubiertos?: string | null
          analisis_tendencias?: string | null
          bruto_neto?: string | null
          created_at?: string
          enfoque_descarbonizacion?: string | null
          gases_cubiertos?: string | null
          id?: string
          metricas_supervision?: string | null
          notas?: string | null
          objetivo_id?: string
          procesos_revision?: string | null
          resultados?: string | null
          revisiones?: string | null
          updated_at?: string
          validacion_tercero?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objetivos_detalle_objetivo_id_fkey"
            columns: ["objetivo_id"]
            isOneToOne: true
            referencedRelation: "objetivos"
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
          rubro_taxonomia: string | null
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
          rubro_taxonomia?: string | null
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
          rubro_taxonomia?: string | null
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
          {
            foreignKeyName: "plantilla_solicitudes_rubro_taxonomia_fkey"
            columns: ["rubro_taxonomia"]
            isOneToOne: false
            referencedRelation: "rubros_taxonomia"
            referencedColumns: ["clave"]
          },
        ]
      }
      plantillas: {
        Row: {
          creado_por: string | null
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
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
      registros_clima: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          horizontes: string[]
          id: string
          nombre: string
          orden: number
          reporte_id: string
          tipo: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          horizontes?: string[]
          id?: string
          nombre: string
          orden?: number
          reporte_id: string
          tipo: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          horizontes?: string[]
          id?: string
          nombre?: string
          orden?: number
          reporte_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_clima_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_clima_valores: {
        Row: {
          cantidad_activos: number | null
          capital_financiacion: number | null
          capital_gasto: number | null
          capital_inversion: number | null
          capturado_por: string | null
          created_at: string
          ejercicio: number
          id: string
          notas: string | null
          porcentaje: number | null
          registro_id: string
        }
        Insert: {
          cantidad_activos?: number | null
          capital_financiacion?: number | null
          capital_gasto?: number | null
          capital_inversion?: number | null
          capturado_por?: string | null
          created_at?: string
          ejercicio: number
          id?: string
          notas?: string | null
          porcentaje?: number | null
          registro_id: string
        }
        Update: {
          cantidad_activos?: number | null
          capital_financiacion?: number | null
          capital_gasto?: number | null
          capital_inversion?: number | null
          capturado_por?: string | null
          created_at?: string
          ejercicio?: number
          id?: string
          notas?: string | null
          porcentaje?: number | null
          registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_clima_valores_capturado_por_fkey"
            columns: ["capturado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_clima_valores_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_clima"
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
      rubros_taxonomia: {
        Row: {
          activo: boolean
          clave: string
          created_at: string
          etiqueta: string
          grupo: string
          orden: number
        }
        Insert: {
          activo?: boolean
          clave: string
          created_at?: string
          etiqueta: string
          grupo: string
          orden?: number
        }
        Update: {
          activo?: boolean
          clave?: string
          created_at?: string
          etiqueta?: string
          grupo?: string
          orden?: number
        }
        Relationships: []
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
          nota_alcance: string | null
          orden: number
          origen: Database["public"]["Enums"]["origen_solicitud"]
          reporte_id: string
          responsable_cliente_id: string | null
          responsable_cliente_texto: string | null
          responsable_irstrat_id: string | null
          rubro_clave: string | null
          rubro_taxonomia: string | null
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
          nota_alcance?: string | null
          orden?: number
          origen?: Database["public"]["Enums"]["origen_solicitud"]
          reporte_id: string
          responsable_cliente_id?: string | null
          responsable_cliente_texto?: string | null
          responsable_irstrat_id?: string | null
          rubro_clave?: string | null
          rubro_taxonomia?: string | null
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
          nota_alcance?: string | null
          orden?: number
          origen?: Database["public"]["Enums"]["origen_solicitud"]
          reporte_id?: string
          responsable_cliente_id?: string | null
          responsable_cliente_texto?: string | null
          responsable_irstrat_id?: string | null
          rubro_clave?: string | null
          rubro_taxonomia?: string | null
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
          {
            foreignKeyName: "solicitudes_rubro_taxonomia_fkey"
            columns: ["rubro_taxonomia"]
            isOneToOne: false
            referencedRelation: "rubros_taxonomia"
            referencedColumns: ["clave"]
          },
        ]
      }
      tenants: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          logo_url: string | null
          nombre: string
          prefijo_folio: string
          slug: string
          staff_puede_cargar: boolean
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          nombre: string
          prefijo_folio: string
          slug: string
          staff_puede_cargar?: boolean
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          nombre?: string
          prefijo_folio?: string
          slug?: string
          staff_puede_cargar?: boolean
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
      fn_is_admin_cliente: { Args: never; Returns: boolean }
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
      fn_perfil_es_del_tenant: {
        Args: { p_perfil: string; p_tenant: string }
        Returns: boolean
      }
      fn_puede_ver_solicitud: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      fn_renombrar_area: {
        Args: { p_area_id: string; p_nombre: string }
        Returns: Json
      }
      fn_reporte_estado_de_solicitud: {
        Args: { p_solicitud_id: string }
        Returns: Database["public"]["Enums"]["estado_reporte"]
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
      origen_solicitud: "irstrat" | "cliente"
      pilar_niif: "gobernanza" | "estrategia" | "riesgos" | "metricas"
      rol_usuario:
        | "cliente"
        | "coordinador"
        | "analista"
        | "admin"
        | "admin_cliente"
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
      origen_solicitud: ["irstrat", "cliente"],
      pilar_niif: ["gobernanza", "estrategia", "riesgos", "metricas"],
      rol_usuario: [
        "cliente",
        "coordinador",
        "analista",
        "admin",
        "admin_cliente",
      ],
    },
  },
} as const

