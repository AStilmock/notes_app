class SpreadSheet < ApplicationRecord
  include Positioned

  MAX_ROWS = 100
  MAX_COLS = 26 # A..Z
  MAX_CELL_LENGTH = 1_000

  belongs_to :user

  validate :cells_must_be_a_grid

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
end
