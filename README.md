# Monopoly Bank - Sistema de Inversiones

## Tipos de Inversión

### 1. Método Cerrado (Seguro)
- Rentabilidad fija: +10% por turno
- Fórmula:
  capital_final = capital * (1 + 0.1 * turnos)
- Riesgo: 0

---

### 2. Método Abierto (Trapecio - Riesgo Alto)

#### Idea:
Simula un comportamiento de mercado por turnos.

Cada turno:
- Variación entre -10% y +30%

Se genera una serie de valores:
V0, V1, V2, ..., Vn

---

### Regla del Trapecio

Se calcula el área bajo la curva:

A ≈ Σ (Vi + Vi+1) / 2

Luego:

valor_final = A / turnos

---

---

### Aplicación en este sistema

En este proyecto, la regla del trapecio no se usa como una fórmula abstracta, sino como una forma de representar el comportamiento acumulado del capital en el tiempo.

En lugar de tomar solo el valor final, se tiene en cuenta toda la trayectoria:

- Cada turno genera un nuevo valor del capital
- Se conectan estos puntos formando segmentos (trapecios)
- Se calcula un promedio ponderado de toda la evolución

Esto permite:

- Evitar resultados extremos irreales
- Simular mejor un comportamiento de mercado
- Representar ganancias acumuladas de forma más estable

En términos simples:

> No importa solo dónde termina el capital, sino cómo llegó hasta ahí.

### Interpretación

- Si la curva sube → ganancia (verde)
- Si baja → pérdida (rojo)
- La gráfica muestra:
  - Evolución del capital
  - Aproximación por trapecios

---

### Balance del sistema

| Tipo       | Riesgo | Ganancia |
|------------|--------|---------|
| Cerrado    | Bajo   | Estable |
| Abierto    | Alto   | Variable |

---

## Visualización

- Línea: evolución del capital
- Área:
  - Verde → crecimiento
  - Rojo → caída