class SpreadSheet < ApplicationRecord
  include Positioned

  MAX_ROWS = 100
  MAX_COLS = 26 # A..Z
  MAX_CELL_LENGTH = 1_000

  # resizable cells, in pixels (spread_sheet_controller.js uses the same limits)
  COL_WIDTHS = 48..1_600
  ROW_HEIGHTS = 24..320

  belongs_to :user

  before_validation :fit_sizes_to_grid

  validate :cells_must_be_a_grid
  validate :sizes_must_be_in_range

  def row_count = cells.size
  def col_count = cells.first&.size.to_i

  private

  def cells_must_be_a_grid
    unless cells.is_a?(Array) && cells.any? && cells.all? { |row| row.is_a?(Array) && row.all?(String) }
      return errors.add(:cells, "must be rows of text cells")
    end

    errors.add(:cells, "must have the same number of columns in every row") if cells.map(&:size).uniq.size > 1
    errors.add(:cells, "must have 1-#{MAX_ROWS} rows and 1-#{MAX_COLS} columns") unless row_count.between?(1, MAX_ROWS) && col_count.between?(1, MAX_COLS)
    errors.add(:cells, "can be at most #{MAX_CELL_LENGTH} characters each") if cells.flatten.any? { |cell| cell.length > MAX_CELL_LENGTH }
  end

  # sizes for rows / columns that no longer exist are dropped rather than rejected
  def fit_sizes_to_grid
    return unless cells.is_a?(Array) && cells.first.is_a?(Array)

    self.col_widths = col_widths.first(col_count) if col_widths.is_a?(Array)
    self.row_heights = row_heights.first(row_count) if row_heights.is_a?(Array)
  end

  def sizes_must_be_in_range
    { col_widths: COL_WIDTHS, row_heights: ROW_HEIGHTS }.each do |attribute, range|
      sizes = self[attribute]
      next if sizes.is_a?(Array) && sizes.all? { |size| size.nil? || (size.is_a?(Integer) && range.cover?(size)) }

      errors.add(attribute, "must be whole pixel sizes from #{range.min} to #{range.max}")
    end
  end
end
