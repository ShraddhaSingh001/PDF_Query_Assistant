import pandas as pd
import plotly.graph_objects as go

# Data
providers = [
    "Groq",
    "Google AI Studio", 
    "GitHub Models",
    "OpenRouter",
    "Together AI"
]
free_tokens = [14400, 60000, 2000, 1000, 5000]
speed_tps = [300, 50, 30, 40, 60]
best_model = [
    "Llama3.3 70B",
    "Gemini2.5Flsh", 
    "GPT-4o",
    "Various",
    "Llama4Scout"
]
key_strength = [
    "Ultra-fast",
    "HighVol",
    "LatestMod", 
    "Variety",
    "Specialized"
]

bar_colors = ["#1FB8CD", "#DB4545", "#2E8B57", "#5D878F", "#D2BA4C"]

# Create text labels combining speed, model and strength
text_labels = [
    f"{speed}TPS | {model} | {strength}" 
    for speed, model, strength in zip(speed_tps, best_model, key_strength)
]

fig = go.Figure()

# Main bars for tokens
fig.add_trace(go.Bar(
    y=providers,
    x=free_tokens,
    orientation='h',
    text=text_labels,
    textposition='auto',
    textfont=dict(size=10, color='white'),
    marker_color=bar_colors,
    hovertemplate='%{y}<br>Tokens: %{x:,.0f}/day<br>Speed: %{customdata}TPS<extra></extra>',
    customdata=speed_tps,
    name="Free Tokens"
))

fig.update_traces(cliponaxis=False)

# Add annotations for speed on the right side
annotations = []
for i, (provider, speed, tokens) in enumerate(zip(providers, speed_tps, free_tokens)):
    annotations.append(
        dict(
            x=tokens + max(free_tokens) * 0.02,
            y=i,
            text=f"{speed}TPS",
            showarrow=False,
            font=dict(size=12, color='#333333'),
            xanchor='left'
        )
    )

fig.update_layout(
    title="Free LLM API Provider Comparison",
    xaxis_title="Tokens/Day",
    yaxis_title="Provider",
    showlegend=False,
    annotations=annotations
)

# Format axes
fig.update_xaxes(
    showgrid=True,
    gridcolor='rgba(128,128,128,0.2)',
    tickformat=".0f"
)

fig.update_yaxes(showgrid=False)

fig.write_image("chart.png")
fig.write_image("chart.svg", format="svg")