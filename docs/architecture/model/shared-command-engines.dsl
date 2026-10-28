// Этот фрагмент включается в browser и server. Это один и тот же исходный код,
// исполняемый в двух средах, а не два независимо поддерживаемых генератора.
giveEngine = component "Генератор /give" "GiveSnapshot → команда с item components Minecraft 1.21.5+." "TypeScript" {
    tags "Shared Code"
    url https://github.com/egorka-dino/mc-commands/blob/main/app/components/give/engine.ts
}
summonEngine = component "Генератор /summon" "SummonSnapshot → команда с equipment и Passengers." "TypeScript" {
    tags "Shared Code"
    url https://github.com/egorka-dino/mc-commands/blob/main/app/components/summon/engine.ts
}
