class NotePad < ApplicationRecord
  before_create :set_position

  scope :ordered, -> { order(:position) }

  private

  # new pads go to the end of the list
  def set_position
    self.position = (NotePad.maximum(:position) || -1) + 1
  end
end
