# 📋 Extrato de Configurações - Monitor AOC U34G4C (34" Ultrawide)

Este guia contém todas as configurações aplicadas para máxima nitidez de texto, cores vibrantes e taxa de 180Hz para uso em trabalho e produtividade.

---

## 🖥️ 1. Configurações no Menu Físico do Monitor (Botões do AOC)

| Item / Menu | Configuração | Motivo |
| :--- | :--- | :--- |
| **Modo de Imagem / Modo Jogo** | **HDR Game** | Melhora o contraste, escurece o traçado das letras e deixa as cores vibrantes. |
| **Nitidez (Sharpness)** | **50** (Neutro) | Evita contorno artificial/esbranquiçado ao redor das letras. |
| **Clear Vision** | **Desligado (OFF)** | Se ligado, causa distorção e serrilhamento em fontes de texto. |
| **DCR (Contraste Dinâmico)** | **Desligado (OFF)** | Evita que o brilho fique oscilando sozinho ao alternar entre janelas claras e escuras. |
| **Adaptive-Sync / FreeSync** | **Desligado (OFF)** | Previne cintilação de brilho (*brightness flicker*) em tela de trabalho e mantém os 180Hz fixos. |
| **Modo PIP / PBP** | **Desligado (OFF)** | Garante que toda a tela fique dedicada a um computador e não derrube a taxa para 60Hz. |

---

## 🍎 2. Configurações no Mac (macOS)

1. **Ajustes de Tela:**
   * **Resolução:** 3440 × 1440 (Nativa)
   * **Taxa de Atualização:** 180.00 Hz (Fixo)
   * **Espelhamento:** Desativado (Modo estendido/tela principal direta)

2. **Suavização de Fontes (Terminal):**
   * Comando executado para engrossar e suavizar as fontes:
     ```bash
     defaults -currentHost write -g AppleFontSmoothing -int 2
     ```
   *(Caso precise reverter algum dia: `defaults -currentHost delete -g AppleFontSmoothing`)*

---

## 🪟 3. Configurações se o PC de Casa for Windows

Caso seu computador de casa use Windows, replique estas configurações:

1. **Taxa de Atualização:**
   * Vá em **Configurações** > **Sistema** > **Tela** > **Configurações avançadas de tela**.
   * Em **Taxa de atualização**, selecione **180 Hz**.

2. **Resolução e Escala (DPI):**
   * **Resolução:** 3440 × 1440 (Recomendado).
   * **Escala:** 100% (espaço máximo) ou 125% (se preferir textos maiores).

3. **Calibração de Fontes do Windows (ClearType):**
   * Pressione a tecla `Windows`, digite **Ajustar texto ClearType** e abra.
   * Certifique-se de marcar "Ativar ClearType" e siga as 5 etapas escolhendo as amostras de texto mais nítidas para seus olhos.

4. **HDR no Windows:**
   * Vá em **Configurações de Tela** e ative o **HDR** (ou use o atalho `Win + Alt + B`).
   * No menu do HDR, ajuste o controle deslizante **"Brilho do conteúdo SDR"** para um nível agradável aos olhos (geralmente entre 30% e 45%).

5. **Painel de Controle NVIDIA / AMD (se tiver placa dedicada):**
   * **G-Sync / FreeSync:** Desativar para janelas normais de trabalho (ou deixar apenas para "Modo de tela cheia").
   * **Formato de cor de saída:** RGB Completo (*Full RGB*), 8-bit ou 10-bit.

---

## 🔌 4. Cabo e Conexões Recomendadas

* **DisplayPort (DP 1.4) ou USB-C com suporte a DP Alt Mode:** Recomendado para alcançar os 180Hz com largura de banda completa e RGB 4:4:4 sem compressão.
* **HDMI:** Alguns cabos HDMI comuns limitam a resolução 3440×1440 a 60Hz ou 100Hz. Dê preferência sempre ao cabo DisplayPort no PC de casa.
