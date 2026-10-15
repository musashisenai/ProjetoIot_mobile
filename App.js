import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

const API_BASE_URL = 'http://10.137.11.6';
const SENSOR_LIST_URL = `${API_BASE_URL}/api/sensor/status/listar`;
const SENSOR_UPDATE_URL = `${API_BASE_URL}/api/sensor/status/atualizar`;
const sensorDetailUrl = (codigo) => `${API_BASE_URL}/api/sensor/status/visualizar/${encodeURIComponent(codigo)}`;
const PAGE_SIZE = 10;

const PALETTES = {
  dark: {
    background: '#07111F',
    surface: '#0E1C2D',
    surfaceRaised: '#13243A',
    surfaceInset: '#0A1726',
    border: '#20344D',
    text: '#F2F7FC',
    muted: '#91A4BB',
    subtle: '#647991',
    accent: '#54A8FF',
    accentStrong: '#1766B3',
    accentTint: 'rgba(84, 168, 255, 0.12)',
    success: '#40D6A2',
    successTint: 'rgba(64, 214, 162, 0.12)',
    danger: '#FF8797',
    dangerTint: 'rgba(255, 135, 151, 0.10)',
    chip: '#0E1C2D',
    chipSelected: '#102C48',
    segmentedSelected: '#203852',
    iconSurface: '#102944',
    inputPlaceholder: '#70849C',
    switchOff: '#334155',
    switchThumbOff: '#CBD5E1',
    switchThumbOn: '#EAF4FF',
    white: '#FFFFFF',
  },
  light: {
    background: '#F3F7FC',
    surface: '#FFFFFF',
    surfaceRaised: '#F8FAFD',
    surfaceInset: '#F3F7FB',
    border: '#DFE7F0',
    text: '#14243A',
    muted: '#61748B',
    subtle: '#8292A5',
    accent: '#2479C8',
    accentStrong: '#1766B3',
    accentTint: 'rgba(36, 121, 200, 0.10)',
    success: '#138A65',
    successTint: 'rgba(19, 138, 101, 0.10)',
    danger: '#D34F65',
    dangerTint: 'rgba(211, 79, 101, 0.09)',
    chip: '#FFFFFF',
    chipSelected: '#E9F3FF',
    segmentedSelected: '#E7F0FA',
    iconSurface: '#E9F3FF',
    inputPlaceholder: '#8998AA',
    switchOff: '#CBD5E1',
    switchThumbOff: '#FFFFFF',
    switchThumbOn: '#FFFFFF',
    white: '#FFFFFF',
  },
};

const SORT_OPTIONS = [
  { key: 'codigo', label: 'Código A–Z' },
  { key: 'tipo', label: 'Tipo A–Z' },
  { key: 'status', label: 'Status' },
];

function isSensorActive(status) {
  return status === 1 || status === true || status === '1' || status === 'true';
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('A API retornou uma resposta inválida.');
  }
}

function getErrorMessage(error) {
  if (error instanceof TypeError) {
    return 'Não foi possível conectar à API. Verifique a rede e confirme se o servidor está acessível.';
  }
  return error?.message || 'Ocorreu um erro inesperado.';
}

function formatFieldLabel(key) {
  const knownLabels = {
    codigo: 'Código',
    tipo: 'Tipo',
    status: 'Status',
    created_at: 'Criado em',
    updated_at: 'Atualizado em',
    data_criacao: 'Data de criação',
    data_atualizacao: 'Data de atualização',
  };
  if (knownLabels[key]) return knownLabels[key];
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

function formatFieldValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function FilterChip({ label, selected, onPress, count, colors }) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        { backgroundColor: colors.chip, borderColor: colors.border },
        selected && { backgroundColor: colors.chipSelected, borderColor: colors.accent },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.filterChipText, { color: selected ? colors.text : colors.muted }]}>{label}</Text>
      {count !== undefined && (
        <Text style={[styles.chipCount, { color: selected ? colors.accent : colors.subtle }]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

function MetricCard({ label, value, tone, icon, colors }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIconWrap, { backgroundColor: tone.tint }]}>
          <Text style={[styles.metricIcon, { color: tone.color }]}>{icon}</Text>
        </View>
        <View style={[styles.metricIndicator, { backgroundColor: tone.color }]} />
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function SensorCard({ sensor, isUpdating, onToggle, onOpen, colors }) {
  const active = isSensorActive(sensor.status);
  const sensorType = sensor.tipo || 'Não informado';
  const statusColor = active ? colors.success : colors.danger;

  return (
    <View style={[styles.sensorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.sensorAccent, { backgroundColor: active ? colors.success : colors.subtle }]} />
      <TouchableOpacity
        style={styles.sensorInfo}
        onPress={() => onOpen(sensor)}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={`Ver detalhes do sensor ${sensor.codigo}`}
      >
        <View style={styles.sensorTitleRow}>
          <Text style={[styles.sensorCode, { color: colors.text }]} numberOfLines={1}>
            {sensor.codigo || 'Sensor sem código'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: active ? colors.successTint : colors.dangerTint }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{active ? 'Ativo' : 'Inativo'}</Text>
          </View>
        </View>
        <View style={styles.sensorDetailsRow}>
          <View style={[styles.typeIconWrap, { backgroundColor: colors.iconSurface }]}>
            <Text style={[styles.typeIcon, { color: colors.accent }]}>◈</Text>
          </View>
          <Text style={[styles.sensorType, { color: colors.muted }]} numberOfLines={1}>{sensorType}</Text>
        </View>
        <View style={styles.detailsLinkRow}>
          <Text style={[styles.detailsLinkText, { color: colors.accent }]}>Ver detalhes</Text>
          <Text style={[styles.detailsLinkArrow, { color: colors.accent }]}>›</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.switchArea}>
        {isUpdating ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Switch
            value={active}
            onValueChange={(value) => onToggle(sensor, value)}
            trackColor={{ false: colors.switchOff, true: colors.accentStrong }}
            thumbColor={active ? colors.switchThumbOn : colors.switchThumbOff}
            ios_backgroundColor={colors.switchOff}
            accessibilityLabel={`Ativar ou desativar sensor ${sensor.codigo}`}
          />
        )}
      </View>
    </View>
  );
}

export default function App() {
  // Por padrão, usa o tema do sistema; o botão permite escolher manualmente outro tema.
  const systemColorScheme = useColorScheme();
  const [themeOverride, setThemeOverride] = useState(null);
  const isDark = (themeOverride || systemColorScheme || 'light') === 'dark';
  const colors = isDark ? PALETTES.dark : PALETTES.light;

  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingCodes, setUpdatingCodes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [sortMode, setSortMode] = useState('codigo');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadSensors = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);

    try {
      const response = await fetch(SENSOR_LIST_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(result?.message || `Falha ao buscar sensores (HTTP ${response.status}).`);
      }

      const list = Array.isArray(result) ? result : result?.data;
      if (!Array.isArray(list)) {
        throw new Error('O formato dos dados recebidos da API não é válido.');
      }

      setSensors(list);
    } catch (error) {
      Alert.alert('Erro ao carregar sensores', getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSensors();
  }, [loadSensors]);

  const refreshList = () => {
    setRefreshing(true);
    loadSensors({ showLoading: false });
  };

  const updateSensorStatus = async (sensor, enabled) => {
    const codigo = sensor?.codigo;
    if (!codigo || updatingCodes.includes(codigo)) return;

    const novoStatus = enabled ? 1 : 0;
    setUpdatingCodes((current) => [...current, codigo]);

    try {
      const response = await fetch(SENSOR_UPDATE_URL, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codigo, status: novoStatus }),
      });
      const result = await readJsonResponse(response);

      if (!response.ok || result?.error) {
        throw new Error(
          result?.message || result?.error || `Falha ao atualizar sensor (HTTP ${response.status}).`,
        );
      }

      // A interface muda somente depois da confirmação de sucesso da API.
      setSensors((current) => current.map((item) => (
        item.codigo === codigo ? { ...item, status: novoStatus } : item
      )));
      setSelectedSensor((current) => (
        current?.codigo === codigo ? { ...current, status: novoStatus } : current
      ));
    } catch (error) {
      Alert.alert('Erro ao atualizar sensor', getErrorMessage(error));
    } finally {
      setUpdatingCodes((current) => current.filter((item) => item !== codigo));
    }
  };

  const openSensorDetails = async (sensor) => {
    const codigo = sensor?.codigo;
    if (!codigo) return;

    setSelectedSensor(sensor);
    setDetailError('');
    setDetailLoading(true);

    try {
      const response = await fetch(sensorDetailUrl(codigo), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const result = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(result?.message || `Falha ao buscar detalhes (HTTP ${response.status}).`);
      }

      const payload = result?.data ?? result;
      const detail = Array.isArray(payload) ? payload[0] : (payload?.sensor || payload?.registro || payload);
      if (!detail || typeof detail !== 'object') {
        throw new Error('A API não retornou os detalhes deste sensor em um formato válido.');
      }

      setSelectedSensor((current) => (
        current?.codigo === codigo ? { ...sensor, ...detail } : current
      ));
    } catch (error) {
      const message = getErrorMessage(error);
      setDetailError(message);
      Alert.alert('Erro ao carregar detalhes', message);
    } finally {
      setDetailLoading(false);
    }
  };

  const sensorTypes = useMemo(() => {
    const types = [...new Set(sensors.map((sensor) => String(sensor.tipo || 'Não informado').trim()))];
    return ['Todos', ...types.sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [sensors]);

  const activeCount = useMemo(
    () => sensors.filter((sensor) => isSensorActive(sensor.status)).length,
    [sensors],
  );
  const inactiveCount = sensors.length - activeCount;
  const activeRate = sensors.length ? Math.round((activeCount / sensors.length) * 100) : 0;

  const filteredSensors = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('pt-BR');
    const filtered = sensors.filter((sensor) => {
      const code = String(sensor.codigo || '').toLocaleLowerCase('pt-BR');
      const type = String(sensor.tipo || 'Não informado').trim();
      const matchesQuery = !normalizedQuery
        || `${code} ${type.toLocaleLowerCase('pt-BR')}`.includes(normalizedQuery);
      const matchesType = typeFilter === 'Todos' || type === typeFilter;
      const active = isSensorActive(sensor.status);
      const matchesStatus = statusFilter === 'todos'
        || (statusFilter === 'ativos' && active)
        || (statusFilter === 'inativos' && !active);
      return matchesQuery && matchesType && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (sortMode === 'tipo') {
        return String(a.tipo || '').localeCompare(String(b.tipo || ''), 'pt-BR')
          || String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR');
      }
      if (sortMode === 'status') {
        return Number(isSensorActive(b.status)) - Number(isSensorActive(a.status))
          || String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR');
      }
      return String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR');
    });
  }, [sensors, searchQuery, typeFilter, statusFilter, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredSensors.length / PAGE_SIZE));
  const pageSensors = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSensors.slice(start, start + PAGE_SIZE);
  }, [filteredSensors, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, statusFilter, sortMode]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  const cycleSortMode = () => {
    const currentIndex = SORT_OPTIONS.findIndex((option) => option.key === sortMode);
    setSortMode(SORT_OPTIONS[(currentIndex + 1) % SORT_OPTIONS.length].key);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('Todos');
    setStatusFilter('todos');
  };

  const toggleTheme = () => {
    setThemeOverride(isDark ? 'light' : 'dark');
  };

  const renderSensor = ({ item }) => (
    <SensorCard
      sensor={item}
      isUpdating={updatingCodes.includes(item.codigo)}
      onToggle={updateSensorStatus}
      onOpen={openSensorDetails}
      colors={colors}
    />
  );

  const hasActiveFilters = searchQuery.trim() !== '' || typeFilter !== 'Todos' || statusFilter !== 'todos';
  const currentSortLabel = SORT_OPTIONS.find((option) => option.key === sortMode)?.label;
  const accentTone = { color: colors.accent, tint: colors.accentTint };
  const successTone = { color: colors.success, tint: colors.successTint };
  const dangerTone = { color: colors.danger, tint: colors.dangerTint };

  const listHeader = (
    <View>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>MONITORAMENTO EM TEMPO REAL</Text>
          <Text style={[styles.heading, { color: colors.text }]}>Sensores</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Gerencie seus dispositivos em um só lugar.</Text>
        </View>
        <TouchableOpacity
          style={[styles.themeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={toggleTheme}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={`Ativar tema ${isDark ? 'claro' : 'escuro'}`}
        >
          <Text style={[styles.themeButtonIcon, { color: colors.accent }]}>{isDark ? '☀' : '☾'}</Text>
          <Text style={[styles.themeButtonText, { color: colors.text }]}>{isDark ? 'Claro' : 'Escuro'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.overviewTop}>
          <View>
            <Text style={[styles.overviewLabel, { color: colors.muted }]}>PAINEL DE DISPOSITIVOS</Text>
            <Text style={[styles.overviewTitle, { color: colors.text }]}>Visão geral</Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.accentStrong }]}
            onPress={refreshList}
            disabled={loading || refreshing}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Atualizar lista de sensores"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Text style={[styles.refreshIcon, { color: colors.white }]}>↻</Text>
                <Text style={[styles.refreshButtonText, { color: colors.white }]}>Atualizar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard label="DISPOSITIVOS" value={sensors.length} tone={accentTone} icon="▦" colors={colors} />
          <MetricCard label="ATIVOS" value={activeCount} tone={successTone} icon="●" colors={colors} />
          <MetricCard label="INATIVOS" value={inactiveCount} tone={dangerTone} icon="○" colors={colors} />
        </View>

        <View style={styles.activitySummary}>
          <View style={styles.activitySummaryTop}>
            <Text style={[styles.activitySummaryLabel, { color: colors.muted }]}>DISPONIBILIDADE</Text>
            <Text style={[styles.activitySummaryValue, { color: colors.text }]}>{activeRate}% ativos</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceInset }]}>
            <View style={[styles.progressFill, { width: `${activeRate}%`, backgroundColor: colors.success }]} />
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>{activeCount} ativos</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>{inactiveCount} inativos</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.searchIcon, { color: colors.accent }]}>⌕</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Pesquisar por código ou tipo..."
          placeholderTextColor={colors.inputPlaceholder}
          style={[styles.searchInput, { color: colors.text, outlineStyle: 'none' }]}
          selectionColor={colors.accent}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Pesquisar sensores por código ou tipo"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={[styles.clearSearchButton, { backgroundColor: colors.surfaceRaised }]}
            accessibilityLabel="Limpar pesquisa"
          >
            <Text style={[styles.clearSearchText, { color: colors.muted }]}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Filtrar por tipo</Text>
          <Text style={[styles.sectionCaption, { color: colors.muted }]}>Escolha uma categoria</Text>
        </View>
        <Text style={[styles.resultCount, { color: colors.muted }]}>
          {filteredSensors.length} resultado{filteredSensors.length === 1 ? '' : 's'}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {sensorTypes.map((type) => (
          <FilterChip
            key={type}
            label={type}
            selected={typeFilter === type}
            count={type === 'Todos'
              ? sensors.length
              : sensors.filter((sensor) => String(sensor.tipo || 'Não informado').trim() === type).length}
            onPress={() => setTypeFilter(type)}
            colors={colors}
          />
        ))}
      </ScrollView>

      <View style={styles.controlsRow}>
        <View style={[styles.statusFilters, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'ativos', label: 'Ativos' },
            { key: 'inativos', label: 'Inativos' },
          ].map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.statusFilter,
                statusFilter === option.key && { backgroundColor: colors.segmentedSelected },
              ]}
              onPress={() => setStatusFilter(option.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.statusFilterText, { color: statusFilter === option.key ? colors.text : colors.muted }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={cycleSortMode}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Ordenar: ${currentSortLabel}. Toque para alterar.`}
        >
          <Text style={[styles.sortIcon, { color: colors.accent }]}>↕</Text>
          <Text style={[styles.sortLabel, { color: colors.text }]}>{currentSortLabel}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listSectionHeader}>
        <Text style={[styles.listTitle, { color: colors.text }]}>Lista de sensores</Text>
        {hasActiveFilters && (
          <TouchableOpacity onPress={clearFilters}>
            <Text style={[styles.clearFiltersText, { color: colors.accent }]}>Limpar filtros</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const detailFields = selectedSensor
    ? Object.entries(selectedSensor).filter(([key, value]) => (
      !['codigo', 'tipo', 'status'].includes(String(key).toLowerCase()) && value !== undefined
    ))
    : [];
  const selectedSensorActive = isSensorActive(selectedSensor?.status);
  const detailStatusColor = selectedSensorActive ? colors.success : colors.danger;

  const detailScreen = selectedSensor ? (
    <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
      <View style={styles.detailHeader}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => { setSelectedSensor(null); setDetailError(''); }}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Voltar para a lista de sensores"
        >
          <Text style={[styles.backButtonArrow, { color: colors.text }]}>‹</Text>
          <Text style={[styles.backButtonText, { color: colors.text }]}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.themeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={toggleTheme}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={`Ativar tema ${isDark ? 'claro' : 'escuro'}`}
        >
          <Text style={[styles.themeButtonIcon, { color: colors.accent }]}>{isDark ? '☀' : '☾'}</Text>
          <Text style={[styles.themeButtonText, { color: colors.text }]}>{isDark ? 'Claro' : 'Escuro'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.detailHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.detailHeroIcon, { backgroundColor: colors.iconSurface }]}>
          <Text style={[styles.detailHeroGlyph, { color: colors.accent }]}>◈</Text>
        </View>
        <Text style={[styles.detailEyebrow, { color: colors.accent }]}>DETALHES DO DISPOSITIVO</Text>
        <Text style={[styles.detailCode, { color: colors.text }]}>{selectedSensor.codigo || 'Sensor sem código'}</Text>
        <Text style={[styles.detailType, { color: colors.muted }]}>{selectedSensor.tipo || 'Tipo não informado'}</Text>
        <View style={[styles.detailStatusBadge, { backgroundColor: selectedSensorActive ? colors.successTint : colors.dangerTint }]}>
          <View style={[styles.statusDot, { backgroundColor: detailStatusColor }]} />
          <Text style={[styles.statusText, { color: detailStatusColor }]}>{selectedSensorActive ? 'Em operação' : 'Desativado'}</Text>
        </View>
        {detailLoading && (
          <View style={styles.detailLoadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.detailLoadingText, { color: colors.muted }]}>Atualizando informações…</Text>
          </View>
        )}
      </View>

      <View style={[styles.detailControlCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.detailControlCopy}>
          <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Controle do sensor</Text>
          <Text style={[styles.detailControlHint, { color: colors.muted }]}>
            {selectedSensorActive ? 'O sensor está marcado como ativo.' : 'O sensor está marcado como inativo.'}
          </Text>
        </View>
        {updatingCodes.includes(selectedSensor.codigo) ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Switch
            value={selectedSensorActive}
            onValueChange={(value) => updateSensorStatus(selectedSensor, value)}
            trackColor={{ false: colors.switchOff, true: colors.accentStrong }}
            thumbColor={selectedSensorActive ? colors.switchThumbOn : colors.switchThumbOff}
            ios_backgroundColor={colors.switchOff}
            accessibilityLabel={`Ativar ou desativar sensor ${selectedSensor.codigo}`}
          />
        )}
      </View>

      {detailError ? (
        <View style={[styles.detailErrorCard, { backgroundColor: colors.dangerTint, borderColor: colors.danger }]}>
          <Text style={[styles.detailErrorText, { color: colors.danger }]}>{detailError}</Text>
          <TouchableOpacity onPress={() => openSensorDetails(selectedSensor)} style={styles.retryButton}>
            <Text style={[styles.retryButtonText, { color: colors.accent }]}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.detailInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.detailInfoHeading}>
          <View>
            <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Informações do sensor</Text>
            <Text style={[styles.detailControlHint, { color: colors.muted }]}>Dados recebidos do serviço</Text>
          </View>
          <TouchableOpacity
            style={[styles.detailRefreshButton, { backgroundColor: colors.iconSurface }]}
            onPress={() => openSensorDetails(selectedSensor)}
            disabled={detailLoading}
            accessibilityLabel="Atualizar informações do sensor"
          >
            {detailLoading ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={[styles.detailRefreshIcon, { color: colors.accent }]}>↻</Text>}
          </TouchableOpacity>
        </View>
        <View style={[styles.detailFieldRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.detailFieldLabel, { color: colors.muted }]}>Código</Text>
          <Text style={[styles.detailFieldValue, { color: colors.text }]}>{formatFieldValue(selectedSensor.codigo)}</Text>
        </View>
        <View style={[styles.detailFieldRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.detailFieldLabel, { color: colors.muted }]}>Tipo</Text>
          <Text style={[styles.detailFieldValue, { color: colors.text }]}>{formatFieldValue(selectedSensor.tipo)}</Text>
        </View>
        <View style={[styles.detailFieldRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.detailFieldLabel, { color: colors.muted }]}>Status</Text>
          <Text style={[styles.detailFieldValue, { color: detailStatusColor }]}>{selectedSensorActive ? 'Ativo (1)' : 'Inativo (0)'}</Text>
        </View>
        {detailFields.length > 0 ? detailFields.map(([key, value]) => (
          <View key={key} style={[styles.detailFieldRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.detailFieldLabel, { color: colors.muted }]}>{formatFieldLabel(key)}</Text>
            <Text style={[styles.detailFieldValue, { color: colors.text }]} selectable>
              {formatFieldValue(value)}
            </Text>
          </View>
        )) : (
          <Text style={[styles.noExtraFields, { color: colors.muted }]}>
            A API não retornou outros campos além do código, tipo e status.
          </Text>
        )}
      </View>

      <View style={styles.detailFooter}>
        <View style={[styles.connectionDot, { backgroundColor: colors.success }]} />
        <Text style={[styles.footerText, { color: colors.subtle }]}>Detalhes sincronizados com a API</Text>
      </View>
    </ScrollView>
  ) : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
        {selectedSensor ? detailScreen : loading ? (
          <View style={styles.loadingScreen}>
            <View style={[styles.loadingMark, { backgroundColor: colors.iconSurface, borderColor: colors.border }]}>
              <Text style={[styles.loadingMarkText, { color: colors.accent }]}>⌁</Text>
            </View>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingTitle, { color: colors.text }]}>Carregando sensores</Text>
            <Text style={[styles.stateText, { color: colors.muted }]}>Conectando ao serviço de dispositivos…</Text>
          </View>
        ) : (
          <FlatList
            data={pageSensors}
            renderItem={renderSensor}
            keyExtractor={(item, index) => String(item.codigo || `sensor-${index}`)}
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refreshList}
                tintColor={colors.accent}
                colors={[colors.accent]}
                progressBackgroundColor={colors.surface}
              />
            }
            ListEmptyComponent={
              <View style={[styles.emptyState, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.iconSurface }]}>
                  <Text style={[styles.emptyIcon, { color: colors.accent }]}>{sensors.length ? '⌕' : '▦'}</Text>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {sensors.length ? 'Nenhum resultado' : 'Nenhum sensor encontrado'}
                </Text>
                <Text style={[styles.stateText, { color: colors.muted }]}>
                  {sensors.length
                    ? 'Tente mudar sua pesquisa ou os filtros selecionados.'
                    : 'Puxe a tela para baixo ou toque em Atualizar.'}
                </Text>
                {sensors.length > 0 && hasActiveFilters && (
                  <TouchableOpacity style={[styles.emptyAction, { backgroundColor: colors.chipSelected }]} onPress={clearFilters}>
                    <Text style={[styles.emptyActionText, { color: colors.accent }]}>Limpar filtros</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            ListFooterComponent={
              <View>
                {filteredSensors.length > 0 && (
                  <View style={[styles.paginationPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.paginationCaption, { color: colors.muted }]}>
                      Exibindo {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredSensors.length)} de {filteredSensors.length}
                    </Text>
                    <View style={styles.paginationRow}>
                      <TouchableOpacity
                        style={[styles.pageArrow, { borderColor: colors.border }, currentPage === 1 && styles.disabledControl]}
                        onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        accessibilityLabel="Página anterior"
                      >
                        <Text style={[styles.pageArrowText, { color: colors.text }]}>‹</Text>
                      </TouchableOpacity>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paginationNumbers}>
                        {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                          <TouchableOpacity
                            key={page}
                            style={[
                              styles.pageNumber,
                              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                              page === currentPage && { backgroundColor: colors.accentStrong, borderColor: colors.accentStrong },
                            ]}
                            onPress={() => setCurrentPage(page)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: page === currentPage }}
                            accessibilityLabel={`Página ${page}`}
                          >
                            <Text style={[styles.pageNumberText, { color: page === currentPage ? colors.white : colors.text }]}>{page}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <TouchableOpacity
                        style={[styles.pageArrow, { borderColor: colors.border }, currentPage === pageCount && styles.disabledControl]}
                        onPress={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                        disabled={currentPage === pageCount}
                        accessibilityLabel="Próxima página"
                      >
                        <Text style={[styles.pageArrowText, { color: colors.text }]}>›</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                <View style={styles.footer}>
                  <View style={[styles.connectionDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.footerText, { color: colors.subtle }]}>Conectado ao serviço de sensores</Text>
                </View>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 20 },
  headerCopy: { flex: 1, paddingRight: 14 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 7 },
  heading: { fontSize: 34, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 5 },
  themeButton: { minWidth: 82, height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, marginLeft: 8, borderWidth: 1, borderRadius: 14 },
  themeButtonIcon: { fontSize: 17, marginRight: 6 },
  themeButtonText: { fontSize: 11, fontWeight: '700' },
  overviewCard: { padding: 16, marginBottom: 18, borderWidth: 1, borderRadius: 20 },
  overviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  overviewLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  overviewTitle: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  refreshButton: { minWidth: 105, height: 38, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  refreshIcon: { fontSize: 20, fontWeight: '700', marginRight: 6 },
  refreshButtonText: { fontSize: 12, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', marginHorizontal: -4 },
  metricCard: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 11, marginHorizontal: 4, borderWidth: 1, borderRadius: 15 },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  metricIcon: { fontSize: 14, fontWeight: '800' },
  metricIndicator: { width: 6, height: 6, borderRadius: 3, opacity: 0.9 },
  metricValue: { fontSize: 23, fontWeight: '800', marginTop: 8 },
  metricLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  activitySummary: { marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: 'rgba(130, 150, 175, 0.18)' },
  activitySummaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  activitySummaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  activitySummaryValue: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 5 },
  progressFill: { height: '100%', borderRadius: 5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  legendText: { fontSize: 10 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 21, borderWidth: 1, borderRadius: 14 },
  searchIcon: { fontSize: 25, lineHeight: 30, marginRight: 10 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 11 },
  clearSearchButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  clearSearchText: { fontSize: 20, lineHeight: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionCaption: { fontSize: 11, marginTop: 3 },
  resultCount: { fontSize: 11, marginBottom: 2 },
  chipsRow: { paddingBottom: 18 },
  filterChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginRight: 8, borderWidth: 1, borderRadius: 12 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  chipCount: { fontSize: 10, fontWeight: '700', marginLeft: 7 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  statusFilters: { flexDirection: 'row', alignItems: 'center', padding: 3, borderWidth: 1, borderRadius: 12 },
  statusFilter: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },
  statusFilterText: { fontSize: 10, fontWeight: '600' },
  sortButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderRadius: 11 },
  sortIcon: { fontSize: 15, fontWeight: '800', marginRight: 5 },
  sortLabel: { fontSize: 10, fontWeight: '600' },
  listSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  listTitle: { fontSize: 16, fontWeight: '700' },
  clearFiltersText: { fontSize: 12, fontWeight: '700' },
  listContent: { flexGrow: 1, paddingBottom: 15 },
  sensorCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderRadius: 16 },
  sensorAccent: { width: 3, alignSelf: 'stretch', borderRadius: 3, marginRight: 12 },
  sensorInfo: { flex: 1, minWidth: 0, paddingRight: 8 },
  sensorTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 7 },
  sensorCode: { fontSize: 14, fontWeight: '700', maxWidth: '78%', marginRight: 8 },
  sensorDetailsRow: { flexDirection: 'row', alignItems: 'center' },
  detailsLinkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  detailsLinkText: { fontSize: 10, fontWeight: '700' },
  detailsLinkArrow: { fontSize: 16, fontWeight: '700', lineHeight: 17, marginLeft: 3 },
  typeIconWrap: { width: 19, height: 19, alignItems: 'center', justifyContent: 'center', marginRight: 6, borderRadius: 6 },
  typeIcon: { fontSize: 11 },
  sensorType: { flex: 1, fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 10, fontWeight: '700' },
  switchArea: { width: 48, alignItems: 'flex-end', justifyContent: 'center' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingMark: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginBottom: 22, borderWidth: 1, borderRadius: 20 },
  loadingMarkText: { fontSize: 36, lineHeight: 42 },
  loadingTitle: { fontSize: 16, fontWeight: '700', marginTop: 17 },
  stateText: { fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, paddingTop: 30, paddingBottom: 36, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16 },
  emptyIconWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderRadius: 16 },
  emptyIcon: { fontSize: 26 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  emptyAction: { paddingHorizontal: 14, paddingVertical: 9, marginTop: 15, borderRadius: 10 },
  emptyActionText: { fontSize: 12, fontWeight: '700' },
  detailContent: { flexGrow: 1, paddingBottom: 20 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 18 },
  backButton: { height: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderRadius: 13 },
  backButtonArrow: { fontSize: 27, lineHeight: 30, marginRight: 5, marginTop: -2 },
  backButtonText: { fontSize: 12, fontWeight: '700' },
  detailHero: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20, marginBottom: 13, borderWidth: 1, borderRadius: 22 },
  detailHeroIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', marginBottom: 13, borderRadius: 19 },
  detailHeroGlyph: { fontSize: 28 },
  detailEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  detailCode: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  detailType: { fontSize: 13, marginTop: 4 },
  detailStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 7, marginTop: 13, borderRadius: 20 },
  detailLoadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13 },
  detailLoadingText: { fontSize: 11, marginLeft: 8 },
  detailControlCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15, marginBottom: 13, borderWidth: 1, borderRadius: 17 },
  detailControlCopy: { flex: 1, paddingRight: 10 },
  detailSectionTitle: { fontSize: 15, fontWeight: '700' },
  detailControlHint: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  detailErrorCard: { padding: 13, marginBottom: 13, borderWidth: 1, borderRadius: 14 },
  detailErrorText: { fontSize: 12, lineHeight: 18 },
  retryButton: { alignSelf: 'flex-start', paddingVertical: 7 },
  retryButtonText: { fontSize: 12, fontWeight: '700' },
  detailInfoCard: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 5, marginBottom: 13, borderWidth: 1, borderRadius: 17 },
  detailInfoHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  detailRefreshButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  detailRefreshIcon: { fontSize: 22, fontWeight: '700' },
  detailFieldRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  detailFieldLabel: { width: '38%', fontSize: 12, fontWeight: '600', paddingRight: 10 },
  detailFieldValue: { flex: 1, fontSize: 12, textAlign: 'right', lineHeight: 18 },
  noExtraFields: { fontSize: 12, lineHeight: 18, paddingVertical: 13 },
  detailFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 7, paddingBottom: 14 },
  paginationPanel: { paddingHorizontal: 12, paddingVertical: 11, marginTop: 2, marginBottom: 4, borderWidth: 1, borderRadius: 15 },
  paginationCaption: { fontSize: 11, textAlign: 'center', marginBottom: 10 },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  paginationNumbers: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5 },
  pageArrow: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  pageArrowText: { fontSize: 24, lineHeight: 28, marginTop: -2 },
  disabledControl: { opacity: 0.35 },
  pageNumber: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginHorizontal: 3, borderWidth: 1, borderRadius: 10 },
  pageNumberText: { fontSize: 12, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 9, paddingBottom: 14 },
  connectionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 7 },
  footerText: { fontSize: 11 },
});
