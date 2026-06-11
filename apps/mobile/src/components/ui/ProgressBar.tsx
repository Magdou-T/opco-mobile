import { Pressable, Text, View } from 'react-native';
import { WIZARD_STEPS, type WizardStep } from '@opco/core';

interface ProgressBarProps {
  currentStepIndex: number;
  onStepClick?: (step: WizardStep) => void;
}

/** Barre de progression du wizard (5 étapes), étapes passées cliquables. */
export function ProgressBar({ currentStepIndex, onStepClick }: ProgressBarProps) {
  return (
    <View className="w-full flex-row" accessibilityLabel="Progression">
      {WIZARD_STEPS.map((step, index) => {
        const isCurrent = index === currentStepIndex;
        const isPast = index < currentStepIndex;
        const isClickable = isPast && !!onStepClick;

        return (
          <Pressable
            key={step.key}
            disabled={!isClickable}
            onPress={() => isClickable && onStepClick(step.key)}
            className="flex-1 items-center"
          >
            <View className="mb-2 w-full flex-row items-center">
              <View
                className={`h-0.5 flex-1 ${
                  index === 0 ? 'opacity-0' : isPast || isCurrent ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  isCurrent || isPast ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    isCurrent || isPast ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {isPast ? '✓' : step.icon}
                </Text>
              </View>
              <View
                className={`h-0.5 flex-1 ${
                  index === WIZARD_STEPS.length - 1
                    ? 'opacity-0'
                    : isPast
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                }`}
              />
            </View>
            <Text
              className={`px-0.5 text-center text-[10px] leading-tight ${
                isCurrent
                  ? 'font-semibold text-blue-600'
                  : isPast
                    ? 'text-gray-600'
                    : 'text-gray-400'
              }`}
              numberOfLines={2}
            >
              {step.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
