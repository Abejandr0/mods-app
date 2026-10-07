# Modelo Físico de ModSim

Este documento describe las fórmulas matemáticas y simplificaciones utilizadas en el motor de simulación de modificaciones de motocicletas (ModSim).

## 1. Cálculo de llantas

Las llantas de moto tienen nomenclaturas estándar como `140/70-17`:
- **Ancho (Width)**: 140 mm.
- **Perfil (Profile)**: 70%. Esto significa que la altura del flanco es el 70% del ancho.
- **Rin (Rim)**: 17 pulgadas.

### Fórmulas
- **Diámetro Total (mm)** = (Rin * 25.4) + 2 * (Ancho * Perfil / 100)
- **Circunferencia (mm)** = Diámetro Total * π

**Simplificación**: Asumimos que la llanta no se deforma por el peso ni por la fuerza centrífuga a altas velocidades.

## 2. Velocidad Teórica y RPM

La velocidad depende puramente de la relación mecánica del motor hasta la llanta.

- **Relación Final (Final Drive Ratio)** = Catalina (dientes) / Piñón (dientes)
- **Relación Total** = Relación Primaria * Relación de Marcha (Gear Ratio) * Relación Final

**Velocidad (km/h) a RPM dadas:**
Velocidad = (RPM / Relación Total) * Circunferencia (mm) * (60 / 1,000,000)

## 3. Límite de Velocidad Aerodinámico

Un vehículo no siempre puede alcanzar la velocidad teórica del corte de inyección en su marcha más alta, ya que se encuentra limitado por la resistencia aerodinámica (Drag) y la potencia del motor.

**Potencia requerida (Vatios)** = 0.5 * Densidad del Aire * Coeficiente de Arrastre (Cd) * Área Frontal * (Velocidad en m/s)³

**Simplificaciones:**
- Ignoramos la fricción de rodadura de las llantas (suele ser marginal comparada con la aerodinámica a altas velocidades).
- Asumimos un factor de pérdida de transmisión fijo del 15% (factor 0.85). Es decir, si el motor tiene 70 HP al cigüeñal, estimamos ~59.5 HP a la rueda.
- Densidad del aire estándar a nivel del mar: 1.225 kg/m³.

## 4. Error del Velocímetro

El sensor del velocímetro suele estar en la caja de cambios o en la rueda dentada. Está calibrado para la circunferencia de la llanta de fábrica. Si cambiamos la llanta, la moto avanza una distancia distinta por cada revolución, pero el velocímetro sigue leyendo igual.

- **Error (%)** = ((Nueva Circunferencia / Circunferencia Original) - 1) * 100

*Un valor positivo significa que la moto va MÁS RÁPIDO de lo que marca el tablero.*

## 5. Fuerza de Tracción Relativa

Cambiar el kit de arrastre (ej. un piñón más pequeño) aumenta la multiplicación de torque a la rueda, lo que resulta en más aceleración pero menor velocidad punta teórica por marcha.
Para comparar configuraciones, calculamos un factor multiplicador relativo:
- Fuerza = Torque a la Rueda / Radio de la Llanta
- Factor = Fuerza Modificada / Fuerza Base

*Ejemplo: un factor de 1.08 significa un 8% más de fuerza (aceleración teórica) en esa marcha.*
