// Petits widgets de formulaire partagés par les étapes du wizard.
// Équivalents RN des <button>/<input>/<select> de la V1 web.

import { Pressable, Text, TextInput, View } from 'react-native';

// --- Bouton de choix (équivalent des boutons "carte" sélectionnables) -------

interface ChoiceButtonProps {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  center?: boolean;
  compact?: boolean;
}

export function ChoiceButton({
  label,
  sublabel,
  selected,
  onPress,
  center,
  compact,
}: ChoiceButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-lg border-2 ${compact ? 'p-2' : 'p-3'} ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        className={`text-sm ${center ? 'text-center' : ''} ${
          selected ? 'font-medium text-blue-900' : 'text-gray-700'
        }`}
      >
        {label}
      </Text>
      {sublabel ? (
        <Text
          className={`mt-1 text-xs ${center ? 'text-center' : ''} ${
            selected ? 'text-blue-900/70' : 'text-gray-500'
          }`}
        >
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

// --- Case à cocher (équivalent <input type="checkbox"> + libellé) -----------

interface CheckboxRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}

export function CheckboxRow({ label, description, checked, onToggle }: CheckboxRowProps) {
  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      className="flex-row items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 active:bg-gray-50"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
          checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
        }`}
      >
        {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900">{label}</Text>
        {description ? <Text className="text-xs text-gray-500">{description}</Text> : null}
      </View>
    </Pressable>
  );
}

// --- Champs texte / nombre ---------------------------------------------------

interface FieldProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  helper?: string;
}

interface TextFieldProps extends FieldProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text className="mb-1 text-sm font-medium text-gray-700">
      {label}
      {required ? <Text className="text-red-500"> *</Text> : null}
    </Text>
  );
}

export function TextField({ label, required, placeholder, helper, value, onChangeText }: TextFieldProps) {
  return (
    <View>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
      />
      {helper ? <Text className="mt-1 text-xs text-gray-500">{helper}</Text> : null}
    </View>
  );
}

interface NumberFieldProps extends FieldProps {
  value: number | null;
  onChangeNumber: (value: number | null) => void;
  /** true → accepte les décimales (parseFloat), sinon entier (parseInt). */
  decimal?: boolean;
}

export function NumberField({
  label,
  required,
  placeholder,
  helper,
  value,
  onChangeNumber,
  decimal,
}: NumberFieldProps) {
  return (
    <View>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value != null ? String(value) : ''}
        onChangeText={(text) => {
          const normalized = text.replace(',', '.');
          if (!normalized.trim()) {
            onChangeNumber(null);
            return;
          }
          const parsed = decimal ? parseFloat(normalized) : parseInt(normalized, 10);
          onChangeNumber(Number.isNaN(parsed) ? null : parsed);
        }}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
      />
      {helper ? <Text className="mt-1 text-xs text-gray-500">{helper}</Text> : null}
    </View>
  );
}

// --- Sélecteur d'OPCO (équivalent <select> de la V1) -------------------------

interface OpcoPickerProps {
  options: { slug: string; name: string; secteurs: string }[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}

export function OpcoPicker({ options, selectedSlug, onSelect }: OpcoPickerProps) {
  return (
    <View className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {options.map((o, i) => {
        const selected = o.slug === selectedSlug;
        return (
          <Pressable
            key={o.slug}
            onPress={() => onSelect(o.slug)}
            className={`px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''} ${
              selected ? 'bg-blue-50' : 'active:bg-gray-50'
            }`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text className={`text-sm ${selected ? 'font-semibold text-blue-900' : 'font-medium text-gray-900'}`}>
              {selected ? '✓ ' : ''}
              {o.name}
            </Text>
            <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={2}>
              {o.secteurs}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
